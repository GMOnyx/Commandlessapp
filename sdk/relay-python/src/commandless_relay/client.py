import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests

DEFAULT_BASE = "https://commandless-app-production.up.railway.app"


@dataclass
class RelayError(Exception):
    status: int
    message: str
    raw_error: Optional[str] = None

    def __str__(self) -> str:
        return f"Commandless error ({self.status}): {self.message}"


class RelayClient:
    def __init__(
        self,
        api_key: str,
        base_url: Optional[str] = None,
        hmac_secret: Optional[str] = None,
        timeout_ms: int = 15000,
        max_retries: int = 3,
        debug: bool = False,
    ) -> None:
        if not api_key:
            raise ValueError("api_key is required")
        self.api_key = api_key
        base = base_url or DEFAULT_BASE
        if not base.startswith(("http://", "https://")):
            base = f"https://{base}"
        self.base_url = base.rstrip("/")
        self.hmac_secret = hmac_secret
        self.timeout = max(timeout_ms / 1000.0, 1)
        self.max_retries = max_retries
        self.bot_id: Optional[str] = None
        self.debug = debug

    def set_bot_id(self, bot_id: Any) -> None:
        self.bot_id = self._normalize_bot_id(bot_id)

    def register_bot(
        self,
        platform: str = "discord",
        name: Optional[str] = None,
        client_id: Optional[str] = None,
        bot_id: Optional[int] = None,
    ) -> Optional[str]:
        normalized_bot_id = self._normalize_bot_id(bot_id)
        payload: Dict[str, Any] = {
            "platform": platform,
            "name": name,
            "clientId": client_id,
            "botId": self._bot_id_for_payload(normalized_bot_id),
        }
        self._debug(f"register_bot payload: platform={platform} clientId={client_id} botId={payload.get('botId')}")
        res = self._post_json("/v1/relay/register", payload)
        if res.get("ok") and isinstance(res.get("data"), dict) and res["data"].get("botId"):
            self.bot_id = self._normalize_bot_id(res["data"]["botId"])
            self._debug(f"register_bot success: botId={self.bot_id}")
            return self.bot_id
        self._debug(f"register_bot failed: status={res.get('status')} err={res.get('error')}")
        return None

    def heartbeat(self) -> Optional[Dict[str, Any]]:
        payload = {"botId": self._bot_id_for_payload(self.bot_id)}
        self._debug(f"heartbeat payload: {payload}")
        res = self._post_json("/v1/relay/heartbeat", payload)
        if res.get("ok"):
            self._debug(f"heartbeat ok: {res.get('data')}")
            return res.get("data")
        self._debug(f"heartbeat failed: status={res.get('status')} err={res.get('error')}")
        return None

    def send_event(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        payload = dict(event)
        if self.bot_id and "botId" not in payload:
            payload["botId"] = self._bot_id_for_payload(self.bot_id)
        elif "botId" in payload:
            payload["botId"] = self._bot_id_for_payload(payload.get("botId"))
        idem = self._make_idempotency_key(payload)

        last_error: Optional[RelayError] = None
        for attempt in range(self.max_retries + 1):
            res = self._post_json("/v1/relay/events", payload, idempotency_key=idem)
            if res.get("ok"):
                data = res.get("data") or {}
                self._debug(
                    f"send_event ok attempt={attempt+1} decision_present={bool(isinstance(data, dict) and data.get('decision') is not None)}"
                )
                if isinstance(data, dict):
                    return data.get("decision")
                return None

            status = int(res.get("status", 0))
            err_text = str(res.get("error") or "unknown")
            parsed_message = self._extract_error_message(err_text) or err_text
            last_error = RelayError(status=status, message=parsed_message, raw_error=err_text)
            self._debug(f"send_event failed attempt={attempt+1} status={status} error={parsed_message}")
            time.sleep(0.2 * (attempt + 1))

        if last_error:
            raise last_error
        raise RelayError(status=0, message="Unknown relay failure")

    def _make_idempotency_key(self, event: Dict[str, Any]) -> str:
        base = f"{event.get('type')}:{event.get('id')}:{int(int(event.get('timestamp', int(time.time() * 1000))) / 1000)}"
        return base64.urlsafe_b64encode(base.encode("utf-8")).decode("utf-8").rstrip("=")

    def _extract_error_message(self, text: str) -> Optional[str]:
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                return str(data.get("message") or data.get("error") or "")
        except Exception:
            pass
        return None

    def _post_json(
        self,
        path: str,
        body: Dict[str, Any],
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        json_body = json.dumps(body, separators=(",", ":"))
        headers = {
            "content-type": "application/json",
            "x-api-key": self.api_key,
            "x-commandless-key": self.api_key,
            "x-timestamp": str(int(time.time() * 1000)),
        }
        if idempotency_key:
            headers["x-idempotency-key"] = idempotency_key
        if self.hmac_secret:
            signature = hmac.new(
                self.hmac_secret.encode("utf-8"),
                json_body.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
            headers["x-signature"] = signature

        try:
            self._debug(f"POST {url}")
            response = requests.post(
                url,
                data=json_body,
                headers=headers,
                timeout=self.timeout,
            )
            if not response.ok:
                return {"ok": False, "status": response.status_code, "error": response.text}
            return {"ok": True, "status": response.status_code, "data": response.json()}
        except Exception as exc:
            return {"ok": False, "status": 0, "error": str(exc)}

    def _normalize_bot_id(self, value: Any) -> Optional[str]:
        if value is None:
            return None
        s = str(value).strip()
        if not s:
            return None
        # Keep numeric bot IDs only; backend expects DB bot id.
        return s if s.isdigit() else None

    def _bot_id_for_payload(self, value: Any) -> Optional[int]:
        normalized = self._normalize_bot_id(value)
        if not normalized:
            return None
        try:
            return int(normalized)
        except Exception:
            return None

    def _debug(self, msg: str) -> None:
        if self.debug:
            print(f"[commandless][debug] {msg}")
