import requests

res = requests.post('http://127.0.0.1:8000/api/manual-blur/1', json={
    "boxes": [{
        "start_frame_number": 0,
        "x": 100,
        "y": 100,
        "width": 100,
        "height": 100,
        "is_tracking": False
    }]
})
print("POST manual-blur:", res.status_code, res.text)
