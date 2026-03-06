import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import requests


@dataclass
class RateLimitEntry:
    count: int
    reset_at: float


class ConfigCache:
    def __init__(self, base_url: str, api_key: str, debug: bool = False) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.debug = debug
        self.config: Optional[Dict[str, Any]] = None
        self.bot_id: Optional[str] = None
        self._poll_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._forced_refetch_done = False
        self._rate_limits: Dict[str, RateLimitEntry] = {}
        self._server_rate_limits: Dict[str, RateLimitEntry] = {}
        self._globally_allowed_from_roles: set[str] = set()
        self._globally_forbidden_from_roles: set[str] = set()

    def _debug(self, msg: str) -> None:
        if self.debug:
            print(f"[commandless][debug] {msg}")

    def fetch(self, bot_id: str) -> Optional[Dict[str, Any]]:
        try:
            self.bot_id = str(bot_id).strip()
            if not self.bot_id:
                return self.config
            current_version = int((self.config or {}).get("version") or 0)
            url = f"{self.base_url}/v1/relay/config?botId={self.bot_id}&version={current_version}"
            headers = {
                "x-api-key": self.api_key,
                "x-commandless-key": self.api_key,
            }
            res = requests.get(url, headers=headers, timeout=15)
            if not res.ok:
                self._debug(f"config fetch failed: status={res.status_code}")
                return None

            data = res.json()
            if data.get("upToDate") and self.config is not None:
                return self.config

            self.config = data
            self._debug(
                f"config loaded: v={self.config.get('version')} "
                f"mode={self.config.get('permissionMode')} premiumUsers={len(self.config.get('premiumUserIds') or [])}"
            )

            # New config should reset role-derived globals.
            self._globally_allowed_from_roles.clear()
            self._globally_forbidden_from_roles.clear()

            has_any_premium = bool(self.config.get("premiumUserIds")) or bool(self.config.get("premiumRoleIds"))
            if (
                not self._forced_refetch_done
                and self.config.get("permissionMode") == "premium_only"
                and not has_any_premium
            ):
                self._forced_refetch_done = True
                self._debug("premium_only with no premium roles/users: forcing one refetch")
                self.config = None
                return self.fetch(self.bot_id)

            return self.config
        except Exception as exc:
            self._debug(f"config fetch exception: {exc}")
            return None

    def start_polling(self, bot_id: str, interval_sec: int = 30) -> None:
        self.stop_polling()
        self._stop_event.clear()

        def _loop() -> None:
            while not self._stop_event.is_set():
                try:
                    self.fetch(bot_id)
                except Exception:
                    pass
                self._stop_event.wait(interval_sec)

        self._poll_thread = threading.Thread(target=_loop, daemon=True)
        self._poll_thread.start()

    def stop_polling(self) -> None:
        self._stop_event.set()
        if self._poll_thread and self._poll_thread.is_alive():
            self._poll_thread.join(timeout=1)
        self._poll_thread = None

    def get_config(self) -> Optional[Dict[str, Any]]:
        return self.config

    def should_process_message(
        self,
        channel_id: str,
        author_id: str,
        guild_id: Optional[str] = None,
        member_roles: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        if not self.config:
            return {"allowed": True}

        if self.config.get("enabled") is False:
            return {"allowed": False, "reason": "Bot disabled"}

        channel_check = self._check_channel(channel_id)
        if not channel_check["allowed"]:
            return channel_check

        perm_check = self._check_permissions(author_id, member_roles or [])
        if not perm_check["allowed"]:
            return perm_check

        rate_check = self._check_rate_limit(author_id, guild_id, member_roles or [])
        if not rate_check["allowed"]:
            return rate_check

        return {"allowed": True}

    def _check_channel(self, channel_id: str) -> Dict[str, Any]:
        mode = self.config.get("channelMode") or "all"
        enabled_channels = self.config.get("enabledChannels") or []
        disabled_channels = self.config.get("disabledChannels") or []
        if mode == "whitelist" and channel_id not in enabled_channels:
            return {"allowed": False, "reason": "Channel not whitelisted"}
        if mode == "blacklist" and channel_id in disabled_channels:
            return {"allowed": False, "reason": "Channel blacklisted"}
        return {"allowed": True}

    def _check_permissions(self, user_id: str, roles: List[str]) -> Dict[str, Any]:
        disabled_users = [str(x) for x in (self.config.get("disabledUsers") or [])]
        enabled_users = [str(x) for x in (self.config.get("enabledUsers") or [])]
        disabled_roles = [str(x) for x in (self.config.get("disabledRoles") or [])]
        enabled_roles = [str(x) for x in (self.config.get("enabledRoles") or [])]
        premium_roles = [str(x) for x in (self.config.get("premiumRoleIds") or [])]
        premium_users = [str(x).strip() for x in (self.config.get("premiumUserIds") or []) if str(x).strip()]

        has_forbidden_role_here = any(r in disabled_roles for r in roles)
        has_allowed_role_here = any(r in enabled_roles for r in roles)
        has_premium_role_here = any(r in premium_roles for r in roles)
        if has_forbidden_role_here:
            self._globally_forbidden_from_roles.add(user_id)
        if has_allowed_role_here or has_premium_role_here:
            self._globally_allowed_from_roles.add(user_id)

        if user_id in disabled_users or user_id in self._globally_forbidden_from_roles:
            return {"allowed": False, "reason": "User blacklisted"}

        mode = self.config.get("permissionMode") or "all"
        if mode == "premium_only":
            is_premium_user = user_id in premium_users
            is_globally_premium_from_role = user_id in self._globally_allowed_from_roles
            is_premium = has_premium_role_here or is_premium_user or is_globally_premium_from_role
            if not is_premium:
                return {"allowed": False, "reason": "Premium only"}
        elif mode == "whitelist":
            is_enabled_user = user_id in enabled_users
            is_globally_enabled_from_role = user_id in self._globally_allowed_from_roles
            if not has_allowed_role_here and not is_enabled_user and not is_globally_enabled_from_role:
                return {"allowed": False, "reason": "No required role"}
        elif mode == "blacklist":
            if has_forbidden_role_here:
                return {"allowed": False, "reason": "Role blacklisted"}

        return {"allowed": True}

    def _check_rate_limit(self, user_id: str, guild_id: Optional[str], roles: List[str]) -> Dict[str, Any]:
        now = time.time()
        premium_roles = [str(x) for x in (self.config.get("premiumRoleIds") or [])]
        premium_users = [str(x).strip() for x in (self.config.get("premiumUserIds") or []) if str(x).strip()]
        is_premium_role = any(r in premium_roles for r in roles)
        is_premium_user = user_id in premium_users
        is_globally_premium_from_role = user_id in self._globally_allowed_from_roles
        is_premium = is_premium_role or is_premium_user or is_globally_premium_from_role

        free_limit = int(self.config.get("freeRateLimit") or 10)
        premium_limit = int(self.config.get("premiumRateLimit") or 50)
        server_limit = int(self.config.get("serverRateLimit") or 100)
        user_limit = premium_limit if is_premium else free_limit

        user_key = f"user:{user_id}"
        entry = self._rate_limits.get(user_key)
        if not entry or now > entry.reset_at:
            self._rate_limits[user_key] = RateLimitEntry(count=1, reset_at=now + 3600)
        else:
            if entry.count >= user_limit:
                return {"allowed": False, "reason": f"Rate limit ({user_limit}/hr)"}
            entry.count += 1

        if guild_id:
            server_key = f"server:{guild_id}"
            s_entry = self._server_rate_limits.get(server_key)
            if not s_entry or now > s_entry.reset_at:
                self._server_rate_limits[server_key] = RateLimitEntry(count=1, reset_at=now + 3600)
            else:
                if s_entry.count >= server_limit:
                    return {"allowed": False, "reason": f"Server rate limit ({server_limit}/hr)"}
                s_entry.count += 1

        return {"allowed": True}

    def cleanup_rate_limits(self) -> None:
        now = time.time()
        self._rate_limits = {k: v for k, v in self._rate_limits.items() if now <= v.reset_at}
        self._server_rate_limits = {k: v for k, v in self._server_rate_limits.items() if now <= v.reset_at}
