from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .models import TIER_CHOICES, Event

TIER_KEYS = [k for k, _ in TIER_CHOICES]
# 沒有設定「票價等級」的活動：依 LUMEN 的比例，以「最低票價」換算
LUMEN_PRICES = {"vip": 6800, "rock": 4800, "stand": 3800, "upper": 2800, "back": 1800}


def tiers_json(e):
    saved = {t.key: t.price for t in e.tiers.all()}
    out = []
    for key in TIER_KEYS:
        price = saved.get(key)
        if price is None:
            price = int(LUMEN_PRICES[key] / 1800 * e.price / 100 + 0.5) * 100
        out.append({"id": key, "price": price})
    return out


def sessions_json(e):
    rows = [
        {
            "id": s.id,
            "date": s.date.isoformat(),
            "time": s.time.strftime("%H:%M"),
            "status": s.status or e.status,
            "desc": s.desc,
            "extra": s.is_extra,
            "doors": s.doors,
            "qrOpen": s.qr_open,
        }
        for s in e.sessions.all()
    ]
    if not rows:  # 後台還沒建立場次時，用首場日期自動產生 1 場，避免前台壞掉
        rows = [{
            "id": f"auto-{e.slug}", "date": e.starts_at.isoformat(), "time": "19:30", "status": e.status,
            "desc": "演出約 150 分鐘", "extra": False, "doors": "", "qrOpen": "",
        }]
    return rows


def event_json(e):
    poster = e.poster_image or f"/images/poster-{e.slug}.webp"
    return {
        "id": e.slug,
        "en": e.en,
        "sub": e.sub,
        "title": e.title,
        "shortTitle": e.short_title or None,
        "date": e.date_text,
        "startsAt": e.starts_at.isoformat(),
        "venue": e.venue,
        "region": e.region,
        "category": e.category,
        "price": e.price,
        "status": e.status,
        "note": e.note,
        "saleAt": e.sale_at_text,
        "saleDate": e.sale_date.isoformat() if e.sale_date else None,
        "art": e.art,
        "poster": poster,
        "banner": e.banner_image or poster,
        "about": e.about,
        "address": e.address,
        "organizer": e.organizer,
        "sessions": sessions_json(e),
        "tiers": tiers_json(e),
    }


@require_GET
def event_list(request):
    qs = Event.objects.filter(is_published=True).prefetch_related("sessions", "tiers")
    events = list(qs)  # 已依 sort_order、首場日期排序
    hero = sorted((e for e in events if e.hero_enabled), key=lambda e: e.hero_order)
    return JsonResponse({
        "events": [event_json(e) for e in events],
        "hot": [e.slug for e in events if e.home_section == "hot"],
        "soon": [e.slug for e in events if e.home_section == "soon"],
        "hero": [
            {
                "eventId": e.slug,
                "tag": e.hero_tag,
                "watermark": e.hero_watermark,
                "dateText": e.hero_date_text,
                "image": e.hero_image or e.banner_image or e.poster_image or f"/images/poster-{e.slug}.webp",
                "position": e.hero_position or "center 30%",
            }
            for e in hero
        ],
    })
