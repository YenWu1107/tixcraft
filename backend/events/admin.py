from django.contrib import admin

from .models import Event, Session, Tier


class SessionInline(admin.TabularInline):
    model = Session
    extra = 1


class TierInline(admin.TabularInline):
    model = Tier
    extra = 0
    verbose_name_plural = "票價等級（沒填的等級會依「最低票價」自動換算）"


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "venue", "starts_at", "price", "status", "home_section", "sort_order", "is_published")
    list_editable = ("status", "sort_order", "is_published")
    list_filter = ("status", "category", "region", "home_section", "is_published")
    search_fields = ("title", "en", "venue", "slug")
    prepopulated_fields = {"slug": ("en",)}
    inlines = [SessionInline, TierInline]
    save_on_top = True

    fieldsets = (
        ("基本資料", {"fields": ("title", "en", "sub", "short_title", "slug", "is_published")}),
        ("時間與地點", {"fields": ("date_text", "starts_at", "venue", "region", "category", "address")}),
        ("票務", {"fields": ("price", "status", "note", "sale_at_text", "sale_date")}),
        ("介紹", {"fields": ("about", "organizer")}),
        ("圖片與外觀", {"fields": ("poster_image", "banner_image", "art")}),
        ("首頁顯示", {"fields": ("home_section", "sort_order")}),
        (
            "首頁輪播",
            {
                "classes": ("collapse",),
                "fields": ("hero_enabled", "hero_order", "hero_tag", "hero_watermark", "hero_date_text", "hero_image", "hero_position"),
            },
        ),
    )
