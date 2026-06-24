"""基础 API 客户端封装"""
import sys
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

import requests
import json
import time
from typing import Optional, Dict, Any, Generator


class BaseAPIClient:
    """通用 API 客户端基类"""
    
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        })
    
    def post(self, endpoint: str, payload: Dict[str, Any], timeout: int = 120) -> Dict[str, Any]:
        """发送 POST 请求"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        response = self.session.post(url, json=payload, timeout=timeout)
        response.raise_for_status()
        return response.json()
    
    def get(self, endpoint: str, params: Optional[Dict] = None, timeout: int = 60) -> Dict[str, Any]:
        """发送 GET 请求"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        response = self.session.get(url, params=params, timeout=timeout)
        response.raise_for_status()
        return response.json()
    
    def poll_task(self, endpoint: str, check_interval: int = 5, max_retries: int = 60) -> Dict[str, Any]:
        """轮询异步任务状态"""
        for _ in range(max_retries):
            result = self.get(endpoint)
            status = result.get('status', '').lower()
            
            if status in ['completed', 'success', 'done']:
                return result
            elif status in ['failed', 'error']:
                raise Exception(f"Task failed: {result.get('error', 'Unknown error')}")
            
            time.sleep(check_interval)
        
        raise TimeoutError("Task polling timeout")


class StreamingAPIClient(BaseAPIClient):
    """支持流式响应的 API 客户端"""
    
    def stream_post(self, endpoint: str, payload: Dict[str, Any]) -> Generator[str, None, None]:
        """流式 POST 请求，逐字返回"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        payload['stream'] = True
        
        with self.session.post(url, json=payload, stream=True) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if line:
                    line = line.decode('utf-8')
                    if line.startswith('data: '):
                        data = line[6:]
                        if data == '[DONE]':
                            break
                        try:
                            chunk = json.loads(data)
                            if 'choices' in chunk and len(chunk['choices']) > 0:
                                delta = chunk['choices'][0].get('delta', {})
                                if 'content' in delta:
                                    yield delta['content']
                        except json.JSONDecodeError:
                            continue
