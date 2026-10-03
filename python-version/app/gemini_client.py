"""Minimal client for Google's Gemini (generativelanguage) REST API."""

import json
from dataclasses import dataclass

import httpx

DEFAULT_MODEL = "gemini-2.5-flash"

DEFAULT_FREEFIRE_PROMPT = """تو یک ویراستار حرفه‌ای محتوای فارسی برای یک کانال تلگرامی تخصصی بازی Free Fire (فری‌فایر) هستی.
وظیفه تو دو بخش دارد:
1) تشخیص بده آیا متن ورودی واقعاً مرتبط با بازی Free Fire است (اخبار، آپدیت، ایونت، کد ردیم، کاراکتر، گان‌اسکین، ترفند، تورنومنت، لیک و...) یا نه. اگر موضوع نامرتبط بود (تبلیغ کانال دیگر، بازی دیگر، محتوای کاملاً بی‌ربط) relevant را false بگذار.
2) اگر مرتبط بود، متن را بازنویسی کن طوری که:
   - کاملاً به زبان فارسی روان و جذاب باشد.
   - هرگونه نام کاربری، لینک، آیدی کانال، شماره تماس یا دعوت به عضویت در کانال/گروه دیگر را کامل حذف کنی.
   - محتوا از نظر متنی با منبع اصلی یکسان (کپی) نباشد؛ یعنی جمله‌بندی، ترتیب و کلمات را به‌گونه‌ای تغییر بده که محتوای اورجینال و منحصربه‌فرد باشد اما اصل خبر/اطلاعات حفظ شود.
   - از ایموجی‌های مرتبط و مناسب به‌صورت متعادل استفاده کن.
   - متن را خلاصه و خوانا نگه دار (حداکثر حدود ۹۰۰ کاراکتر).
فقط خروجی را در قالب JSON مطابق اسکیمای داده‌شده برگردان."""

DEFAULT_GOLD_PROMPT = """تو یک ویراستار حرفه‌ای محتوای فارسی برای یک کانال تلگرامی تخصصی قیمت طلا، سکه و ارز هستی.
وظیفه تو:
1) اگر متن ورودی حاوی اطلاعات قیمت طلا/سکه/دلار/ارز بود relevant را true بگذار؛ در غیر این صورت (مثلاً تبلیغ یا محتوای بی‌ربط) false بگذار.
2) متن را بازنویسی کن طوری که:
   - اعداد و قیمت‌ها دقیقاً حفظ شوند (هیچ عددی را تغییر نده یا حدس نزن).
   - هر نوع لینک، آیدی کانال، نام کاربری یا دعوت به عضویت در کانال/گروه دیگر را کامل حذف کنی.
   - نوشتار را تمیز، مرتب و با ایموجی‌های مناسب (💰 🪙 📈 📉) فرمت کن.
   - جمله‌بندی را نسبت به متن اصلی تغییر بده تا محتوای یکتا و غیرکپی باشد اما اعداد دست‌نخورده بمانند.
فقط خروجی را در قالب JSON مطابق اسکیمای داده‌شده برگردان."""


@dataclass
class AnalyzeResult:
    relevant: bool
    rewritten_text: str
    reason: str = ""


RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "relevant": {"type": "BOOLEAN"},
        "rewritten_text": {"type": "STRING"},
        "reason": {"type": "STRING"},
    },
    "required": ["relevant", "rewritten_text"],
}


async def analyze_post(api_key: str, model: str, prompt: str, text: str) -> AnalyzeResult:
    if not api_key:
        raise RuntimeError("Gemini API key is not configured")

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model or DEFAULT_MODEL}:generateContent?key={api_key}"
    )
    body = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": f'{prompt}\n\n---\nمتن پست ورودی:\n"""{text or "(بدون متن)"}"""'}],
            }
        ],
        "generationConfig": {
            "temperature": 0.9,
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
        },
    }

    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(url, json=body)
        if res.status_code >= 400:
            raise RuntimeError(f"Gemini HTTP {res.status_code}: {res.text[:300]}")
        data = res.json()

    try:
        text_out = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text_out)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Gemini returned an unparsable response: {exc}") from exc

    return AnalyzeResult(
        relevant=bool(parsed.get("relevant")),
        rewritten_text=(parsed.get("rewritten_text") or "").strip(),
        reason=parsed.get("reason", ""),
    )
