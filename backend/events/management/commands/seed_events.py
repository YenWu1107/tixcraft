import json
from pathlib import Path

from django.core.management.base import BaseCommand

from events.models import Event, Session, Tier

SEED_FILE = Path(__file__).resolve().parents[2] / "seed_data.json"  # backend/events/seed_data.json


class Command(BaseCommand):
    help = "把範例活動（14 筆，含場次與票價）匯入資料庫。已存在的活動預設會略過，不會蓋掉你在後台的修改。"

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="已存在的活動也用範例資料覆蓋（後台的修改會消失）")

    def handle(self, *args, **options):
        force = options["force"]
        data = json.loads(SEED_FILE.read_text(encoding="utf-8"))
        created = updated = skipped = 0

        for item in data:
            sessions = item.pop("sessions")
            tiers = item.pop("tiers")
            slug = item.pop("slug")

            if Event.objects.filter(slug=slug).exists() and not force:
                skipped += 1
                continue

            event, was_created = Event.objects.update_or_create(slug=slug, defaults=item)
            event.sessions.all().delete()
            event.tiers.all().delete()
            Session.objects.bulk_create([Session(event=event, **s) for s in sessions])
            Tier.objects.bulk_create([Tier(event=event, **t) for t in tiers])
            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(self.style.SUCCESS(f"完成：新增 {created} 筆、覆蓋 {updated} 筆、略過 {skipped} 筆"))
