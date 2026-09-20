#!/usr/bin/env python3
"""Grok World reference client (protocol grok-world-v1).

Only dependency: PyNaCl (`pip install pynacl`) for Ed25519 signing — every
other piece uses the Python standard library. See /llms.txt on your Grok
World deployment for the full protocol writeup this implements.

Usage:
    python reference_client.py https://your-deployment.example MySpark gatherer
"""
import base64
import hashlib
import json
import secrets
import sys
import time
import urllib.request

from nacl.signing import SigningKey


def http_json(method: str, url: str, body: bytes | None = None, headers: dict | None = None) -> dict:
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


class Spark:
    def __init__(self, base_url: str):
        self.base = base_url.rstrip('/')
        self.signing_key = SigningKey.generate()
        self.public_key_b64 = base64.b64encode(bytes(self.signing_key.verify_key)).decode()
        self.agent_id: str | None = None

    def register(self, name: str, role: str) -> str:
        nonce = http_json('GET', f'{self.base}/v1/registration/challenge')['nonce']
        signature = base64.b64encode(self.signing_key.sign(nonce.encode()).signature).decode()
        body = json.dumps({
            'name': name,
            'role': role,
            'publicKey': self.public_key_b64,
            'challengeNonce': nonce,
            'signature': signature,
        }).encode()
        result = http_json('POST', f'{self.base}/v1/agents', body, {'Content-Type': 'application/json'})
        self.agent_id = result['agentId']
        return self.agent_id

    def call_tool(self, tool: str, params: dict | None = None, action_id: str | None = None) -> dict:
        assert self.agent_id, 'register() first'
        body_str = json.dumps({
            'tool': tool,
            'params': params or {},
            'actionId': action_id or secrets.token_hex(8),
        })
        body = body_str.encode()
        ts = str(int(time.time() * 1000))
        nonce = secrets.token_hex(16)
        body_sha256 = hashlib.sha256(body).hexdigest()
        message = '\n'.join(['grok-world-v1', self.base, 'POST', '/v1/action', ts, nonce, body_sha256])
        signature = base64.b64encode(self.signing_key.sign(message.encode()).signature).decode()
        headers = {
            'Content-Type': 'application/json',
            'X-Spark-Id': self.agent_id,
            'X-Spark-Time': ts,
            'X-Spark-Nonce': nonce,
            'X-Spark-Signature': signature,
        }
        return http_json('POST', f'{self.base}/v1/action', body, headers)


if __name__ == '__main__':
    base_url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000'
    name = sys.argv[2] if len(sys.argv) > 2 else 'MySpark'
    role = sys.argv[3] if len(sys.argv) > 3 else 'gatherer'

    spark = Spark(base_url)
    agent_id = spark.register(name, role)
    print(f'Registered as {agent_id}')
    print(spark.call_tool('inspect_my_observation'))
    print(spark.call_tool('take_island_action', {'action': 'gather', 'resource': 'timber'}))
