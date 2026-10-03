// Thin wrapper around Google's Gemini (generativelanguage) REST API.
// Deliberately dependency-free (uses fetch) to keep the project lightweight.

const DEFAULT_MODEL = "gemini-2.5-flash";

interface GeminiJsonResponse {
  relevant: boolean;
  rewritten_text: string;
  reason?: string;
}

function extractJsonText(raw: unknown): string | null {
  try {
    const obj = raw as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = obj.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    return text ?? null;
  } catch {
    return null;
  }
}

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userText: string,
): Promise<GeminiJsonResponse | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model || DEFAULT_MODEL,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n---\nمتن پست ورودی:\n"""${userText || "(بدون متن)"}"""` }],
      },
    ],
    generationConfig: {
      temperature: 0.9,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          relevant: { type: "BOOLEAN" },
          rewritten_text: { type: "STRING" },
          reason: { type: "STRING" },
        },
        required: ["relevant", "rewritten_text"],
      },
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }
    const json = await res.json();
    const text = extractJsonText(json);
    if (!text) return null;
    const parsed = JSON.parse(text) as GeminiJsonResponse;
    return parsed;
  } catch (err) {
    throw err instanceof Error ? err : new Error("Gemini request failed");
  }
}

export const DEFAULT_FREEFIRE_PROMPT = `تو یک ویراستار حرفه‌ای محتوای فارسی برای یک کانال تلگرامی تخصصی بازی Free Fire (فری‌فایر) هستی.
وظیفه تو دو بخش دارد:
1) تشخیص بده آیا متن ورودی واقعاً مرتبط با بازی Free Fire است (اخبار، آپدیت، ایونت، کد ردیم، کاراکتر، گان‌اسکین، ترفند، تورنومنت، لیک و...) یا نه. اگر موضوع نامرتبط بود (تبلیغ کانال دیگر، بازی دیگر، محتوای کاملاً بی‌ربط) relevant را false بگذار.
2) اگر مرتبط بود، متن را بازنویسی کن طوری که:
   - کاملاً به زبان فارسی روان و جذاب باشد.
   - هرگونه نام کاربری، لینک، آیدی کانال، شماره تماس یا دعوت به عضویت در کانال/گروه دیگر را کامل حذف کنی.
   - محتوا از نظر متنی با منبع اصلی یکسان (کپی) نباشد؛ یعنی جمله‌بندی، ترتیب و کلمات را به‌گونه‌ای تغییر بده که محتوای اورجینال و منحصربه‌فرد باشد اما اصل خبر/اطلاعات حفظ شود.
   - از ایموجی‌های مرتبط و مناسب به‌صورت متعادل استفاده کن.
   - متن را خلاصه و خوانا نگه دار (حداکثر حدود ۹۰۰ کاراکتر).
فقط خروجی را در قالب JSON مطابق اسکیمای داده‌شده برگردان.`;

export const DEFAULT_GOLD_PROMPT = `تو یک ویراستار حرفه‌ای محتوای فارسی برای یک کانال تلگرامی تخصصی قیمت طلا، سکه و ارز هستی.
وظیفه تو:
1) اگر متن ورودی حاوی اطلاعات قیمت طلا/سکه/دلار/ارز بود relevant را true بگذار؛ در غیر این صورت (مثلاً تبلیغ یا محتوای بی‌ربط) false بگذار.
2) متن را بازنویسی کن طوری که:
   - اعداد و قیمت‌ها دقیقاً حفظ شوند (هیچ عددی را تغییر نده یا حدس نزن).
   - هر نوع لینک، آیدی کانال، نام کاربری یا دعوت به عضویت در کانال/گروه دیگر را کامل حذف کنی.
   - نوشتار را تمیز، مرتب و با ایموجی‌های مناسب (💰 🪙 📈 📉) فرمت کن.
   - جمله‌بندی را نسبت به متن اصلی تغییر بده تا محتوای یکتا و غیرکپی باشد اما اعداد دست‌نخورده بمانند.
فقط خروجی را در قالب JSON مطابق اسکیمای داده‌شده برگردان.`;

export interface AnalyzeResult {
  relevant: boolean;
  rewrittenText: string;
  reason: string;
}

export async function analyzePost(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  text: string;
}): Promise<AnalyzeResult> {
  const { apiKey, model, prompt, text } = opts;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured");
  }
  const result = await callGemini(apiKey, model, prompt, text);
  if (!result) {
    throw new Error("Gemini returned an unparsable response");
  }
  return {
    relevant: Boolean(result.relevant),
    rewrittenText: (result.rewritten_text || "").trim(),
    reason: result.reason || "",
  };
}
