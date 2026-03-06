import unittest

from commandless_relay.config_cache import ConfigCache


class TestConfigCache(unittest.TestCase):
    def test_whitelist_allows_enabled_user(self):
        cc = ConfigCache("https://example.com", "k")
        cc.config = {
            "enabled": True,
            "channelMode": "all",
            "permissionMode": "whitelist",
            "enabledRoles": [],
            "enabledUsers": ["u1"],
            "disabledRoles": [],
            "disabledUsers": [],
            "premiumRoleIds": [],
            "premiumUserIds": [],
            "freeRateLimit": 10,
            "premiumRateLimit": 50,
            "serverRateLimit": 100,
        }
        res = cc.should_process_message(channel_id="c1", author_id="u1", guild_id="g1", member_roles=[])
        self.assertTrue(res["allowed"])

    def test_blacklist_blocks_disabled_user(self):
        cc = ConfigCache("https://example.com", "k")
        cc.config = {
            "enabled": True,
            "channelMode": "all",
            "permissionMode": "all",
            "enabledRoles": [],
            "enabledUsers": [],
            "disabledRoles": [],
            "disabledUsers": ["u2"],
            "premiumRoleIds": [],
            "premiumUserIds": [],
            "freeRateLimit": 10,
            "premiumRateLimit": 50,
            "serverRateLimit": 100,
        }
        res = cc.should_process_message(channel_id="c1", author_id="u2", guild_id="g1", member_roles=[])
        self.assertFalse(res["allowed"])
        self.assertEqual(res["reason"], "User blacklisted")


if __name__ == "__main__":
    unittest.main()
