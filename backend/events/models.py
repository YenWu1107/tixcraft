import datetime

from django.db import models

STATUS_CHOICES = [
    ("hot", "熱賣中"),
    ("soon", "即將開賣"),
    ("few", "少量餘票"),
    ("soldout", "已售完"),
]
CATEGORY_CHOICES = [(c, c) for c in ["演唱會", "音樂劇", "古典與爵士", "音樂節", "脫口秀", "展覽", "體育"]]
REGION_CHOICES = [(r, r) for r in ["臺北", "新北", "臺中", "高雄", "其他"]]
SECTION_CHOICES = [
    ("", "不放在首頁區塊"),
    ("hot", "首頁・熱賣中"),
    ("soon", "首頁・即將開賣"),
]
TIER_CHOICES = [
    ("vip", "特區"),
    ("rock", "搖滾區"),
    ("stand", "1 樓看台"),
    ("upper", "2 樓看台"),
    ("back", "5 樓看台"),
]


def default_art():
    """海報載入失敗時顯示的備用色塊（一般不用改）"""
    return {
        "bg": "#0B1230", "c1": "#F5B65E", "c2": "rgba(255,255,255,0.35)", "fg": "#FFFFFF",
        "orb": "64%", "ox": "18%", "oy": "8%", "ring": "96%", "rx": "2%", "ry": "-6%",
    }


class Event(models.Model):
    # 基本資料
    slug = models.SlugField("網址代號", unique=True, help_text="只能用英文、數字、-。網址會是 /event/代號，建立後請勿隨意更改")
    en = models.CharField("英文主標", max_length=80, help_text="海報與標題上的大字，例：LUMEN")
    sub = models.CharField("英文副標", max_length=120, blank=True)
    title = models.CharField("完整活動名稱", max_length=200)
    short_title = models.CharField("簡短名稱", max_length=60, blank=True, help_text="麵包屑與付款頁使用，留空會用英文主標")
    is_published = models.BooleanField("上架（前台顯示）", default=True)

    # 時間地點
    date_text = models.CharField("日期顯示文字", max_length=60, help_text="例：2026.12.12（六）– 12.13（日）")
    starts_at = models.DateField("首場日期", help_text="搜尋與排序使用")
    venue = models.CharField("場館", max_length=100)
    region = models.CharField("地區", max_length=10, choices=REGION_CHOICES, default="臺北")
    category = models.CharField("類別", max_length=20, choices=CATEGORY_CHOICES, default="演唱會")
    address = models.TextField("場館地址／交通", blank=True, help_text="可換行；留空顯示「詳細地址將於開賣前公布」")

    # 票務
    price = models.PositiveIntegerField("最低票價", help_text="沒有填寫「票價等級」時，會依這個價格自動換算各等級票價")
    status = models.CharField("售票狀態", max_length=10, choices=STATUS_CHOICES, default="hot")
    note = models.CharField("卡片備註", max_length=60, blank=True, help_text="例：共 2 場、僅剩少量座位")
    sale_at_text = models.CharField("開賣時間文字", max_length=40, blank=True, help_text="即將開賣的活動使用，例：10.24（六）12:00")
    sale_date = models.DateField("開賣日期", null=True, blank=True)

    # 圖片與外觀
    poster_image = models.CharField("海報圖路徑", max_length=200, blank=True, help_text="留空 = /images/poster-網址代號.webp。圖片檔放在專案 public/images/")
    banner_image = models.CharField("活動頁橫幅路徑", max_length=200, blank=True, help_text="例：/images/banner-lumen.webp；留空會用海報")
    art = models.JSONField("備用色塊（海報載入失敗時）", default=default_art, blank=True)

    # 介紹
    about = models.TextField("節目介紹", blank=True)
    organizer = models.CharField("主辦單位", max_length=100, blank=True)

    # 首頁顯示
    home_section = models.CharField("首頁區塊", max_length=10, choices=SECTION_CHOICES, blank=True, default="")
    sort_order = models.PositiveIntegerField("排序", default=100, help_text="數字小的排前面（搜尋「推薦排序」與首頁區塊都用這個）")

    # 首頁輪播
    hero_enabled = models.BooleanField("放進首頁輪播", default=False)
    hero_order = models.PositiveIntegerField("輪播順序", default=0)
    hero_tag = models.CharField("輪播左上標籤", max_length=40, blank=True, help_text="例：全台首站・熱賣中")
    hero_watermark = models.CharField("輪播背景大字", max_length=20, blank=True)
    hero_date_text = models.CharField("輪播日期文字", max_length=40, blank=True)
    hero_image = models.CharField("輪播圖路徑", max_length=200, blank=True, help_text="例：/images/hero-lumen.webp；留空會用橫幅或海報")
    hero_position = models.CharField("輪播圖對齊", max_length=30, blank=True, default="center 30%")

    class Meta:
        verbose_name = "活動"
        verbose_name_plural = "活動"
        ordering = ["sort_order", "starts_at"]

    def __str__(self):
        return self.title


class Session(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="sessions", verbose_name="活動")
    date = models.DateField("日期")
    time = models.TimeField("開演時間", default=datetime.time(19, 30))
    status = models.CharField("場次狀態", max_length=10, choices=STATUS_CHOICES, blank=True, help_text="留空 = 跟隨活動的售票狀態")
    desc = models.CharField("說明", max_length=100, blank=True, default="演出約 150 分鐘")
    is_extra = models.BooleanField("加場", default=False)
    doors = models.CharField("入場時間說明", max_length=40, blank=True, help_text="例：18:00；留空顯示「開演前 90 分鐘」")
    qr_open = models.CharField("票券開放出示時間", max_length=40, blank=True, help_text="例：12.11（五）19:30；留空顯示「演出前一天」")

    class Meta:
        verbose_name = "場次"
        verbose_name_plural = "場次"
        ordering = ["date", "time"]

    def __str__(self):
        return f"{self.event.slug} {self.date} {str(self.time)[:5]}"


class Tier(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="tiers", verbose_name="活動")
    key = models.CharField("票價等級", max_length=10, choices=TIER_CHOICES)
    price = models.PositiveIntegerField("票價")

    class Meta:
        verbose_name = "票價等級"
        verbose_name_plural = "票價等級"
        constraints = [models.UniqueConstraint(fields=["event", "key"], name="unique_tier_per_event")]

    def __str__(self):
        return f"{self.event.slug} {self.get_key_display()} {self.price}"
