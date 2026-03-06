import unittest
from unittest.mock import patch

from commandless_relay.client import RelayClient, RelayError


class TestRelayClient(unittest.TestCase):
    def test_normalize_and_payload_bot_id(self):
        c = RelayClient(api_key="k")
        c.set_bot_id(" 93 ")
        self.assertEqual(c.bot_id, "93")
        self.assertEqual(c._bot_id_for_payload(c.bot_id), 93)
        self.assertIsNone(c._bot_id_for_payload("abc"))

    @patch("commandless_relay.client.requests.post")
    def test_send_event_returns_decision(self, mock_post):
        class R:
            ok = True
            status_code = 200

            def json(self):
                return {"decision": {"actions": [{"kind": "reply", "content": "hi"}]}}

        mock_post.return_value = R()
        c = RelayClient(api_key="k")
        dec = c.send_event({"type": "messageCreate", "id": "1", "timestamp": 1000})
        self.assertIsNotNone(dec)
        self.assertEqual(dec["actions"][0]["kind"], "reply")

    @patch("commandless_relay.client.requests.post")
    def test_send_event_raises_after_retries(self, mock_post):
        class R:
            ok = False
            status_code = 402
            text = '{"error":"Payment Required","code":"SUBSCRIPTION_REQUIRED"}'

        mock_post.return_value = R()
        c = RelayClient(api_key="k", max_retries=0)
        with self.assertRaises(RelayError) as err:
            c.send_event({"type": "messageCreate", "id": "1", "timestamp": 1000})
        self.assertEqual(err.exception.status, 402)


if __name__ == "__main__":
    unittest.main()
