from datetime import datetime, timedelta


def create_lead(client, name: str = "Ada Lovelace", **fields) -> dict:
    response = client.post("/api/leads", json={"name": name, **fields})
    assert response.status_code == 201, response.text
    return response.json()


def log_discussion(client, lead_id: str, note: str = "Had a call.", **fields):
    return client.post(f"/api/leads/{lead_id}/discussions", json={"note": note, **fields})


def get_lead(client, lead_id: str) -> dict:
    response = client.get(f"/api/leads/{lead_id}")
    assert response.status_code == 200, response.text
    return response.json()


def iso(dt: datetime) -> str:
    return dt.isoformat()


def in_(clock, **delta) -> str:
    """ISO timestamp relative to the frozen clock (aware UTC)."""
    return (clock.now + timedelta(**delta)).isoformat()


def names(page: dict) -> list[str]:
    return [item["name"] for item in page["items"]]
