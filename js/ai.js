// Gemini through Firebase AI Logic: reading bank screenshots and writing advice.
import { app, getAiModule } from "./firebase.js";
import { CATEGORIES, EXPENSE_CATS } from "./categories.js";

// Tried in order; the first one that answers is remembered.
const MODELS = ["gemini-3.5-flash", "gemini-3-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash"];
const MODEL_KEY = "budzet.model";

let aiInstance = null;
async function ai() {
  const mod = await getAiModule();
  aiInstance ??= mod.getAI(app, { backend: new mod.GoogleAIBackend() });
  return { mod, ai: aiInstance };
}

async function generate(buildRequest, generationConfig) {
  const { mod, ai: inst } = await ai();
  const remembered = localStorage.getItem(MODEL_KEY);
  const order = remembered ? [remembered, ...MODELS.filter((m) => m !== remembered)] : MODELS;
  let lastErr;
  for (const model of order) {
    try {
      const m = mod.getGenerativeModel(inst, { model, generationConfig });
      const res = await m.generateContent(buildRequest());
      localStorage.setItem(MODEL_KEY, model);
      return res.response.text();
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message ?? e);
      // Only fall through to the next model when this one does not exist / is not allowed.
      if (!/not found|404|not supported|unsupported|is not available|permission|403/i.test(msg)) throw e;
      if (/app.?check/i.test(msg)) throw e;
      console.warn(`Model ${model} unavailable`, msg);
    }
  }
  throw lastErr;
}

/** Downscales an image file to JPEG base64 so requests stay small. */
export async function fileToBase64Jpeg(file, maxSide = 1800) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
  const url = canvas.toDataURL("image/jpeg", 0.88);
  return { data: url.split(",")[1], mimeType: "image/jpeg", preview: url };
}

const catList = CATEGORIES.map((c) => `${c.id} = ${c.name}`).join("\n");

/**
 * Reads transactions from one or more bank-app screenshots.
 * Returns [{date, merchant, description, amount, aiCategory, aiConfidence}].
 */
export async function readScreenshots(images, todayIso) {
  const { mod } = await ai();
  const S = mod.Schema;
  const schema = S.object({
    properties: {
      transactions: S.array({
        items: S.object({
          properties: {
            date: S.string({ description: "Data transakcji w formacie RRRR-MM-DD" }),
            merchant: S.string({ description: "Nazwa sklepu / odbiorcy / nadawcy, oczyszczona z numerów kart i kodów" }),
            description: S.string({ description: "Dodatkowy opis z ekranu, np. tytuł przelewu" }),
            amount: S.number({ description: "Kwota w PLN: ujemna dla wydatku/obciążenia, dodatnia dla wpływu" }),
            category: S.enumString({ enum: [...CATEGORIES.map((c) => c.id), "nieznana"] }),
            confidence: S.number({ description: "Pewność kategorii 0..1" }),
          },
          optionalProperties: ["description"],
        }),
      }),
    },
  });

  const prompt = `Jesteś asystentem budżetu domowego. Na załączonych zrzutach ekranu jest historia płatności z polskiej aplikacji bankowej.
Wypisz KAŻDĄ widoczną transakcję (zarówno wydatki, jak i wpływy). Zasady:
- Dzisiaj jest ${todayIso}. Zamień „Dzisiaj”, „Wczoraj”, nazwy dni tygodnia i daty bez roku na pełną datę RRRR-MM-DD (rok bieżący, chyba że data byłaby w przyszłości — wtedy poprzedni rok). Jeśli transakcja nie ma własnej daty, użyj daty z najbliższego nagłówka powyżej.
- Kwota: liczba w złotych z kropką dziesiętną. Wydatki/obciążenia/płatności kartą/BLIK/przelewy wychodzące = ujemne, wpływy/uznania/zwroty = dodatnie. Jeśli kwota jest w innej walucie, a obok jest kwota w PLN, użyj PLN.
- Pomiń salda, limity, reklamy, transakcje odrzucone i blokady (np. „odrzucona”, „anulowana”). Transakcje „oczekujące” uwzględnij.
- Nie dubluj tej samej transakcji, jeśli zrzuty się nakładają.
- merchant: krótka czytelna nazwa (np. „Biedronka”, „Orlen”, „Netflix”, „Jan Kowalski”).
- category: wybierz jedną z listy poniżej. Jeśli nie da się rozsądnie ocenić (np. przelew do osoby bez tytułu, nieznana firma) — użyj „nieznana” i niskiej pewności.
Kategorie:
${catList}`;

  const text = await generate(
    () => [prompt, ...images.map((img) => ({ inlineData: { data: img.data, mimeType: img.mimeType } }))],
    { responseMimeType: "application/json", responseSchema: schema, temperature: 0.1 },
  );
  const parsed = JSON.parse(text);
  return (parsed.transactions ?? [])
    .filter((t) => Number.isFinite(Number(t.amount)) && Number(t.amount) !== 0)
    .map((t) => ({
      date: /^\d{4}-\d{2}-\d{2}$/.test(t.date ?? "") ? t.date : todayIso,
      merchant: (t.merchant ?? "").trim() || "Nieznany",
      description: (t.description ?? "").trim(),
      amount: Math.round(Number(t.amount) * 100) / 100,
      aiCategory: t.category === "nieznana" ? null : t.category,
      aiConfidence: Number(t.confidence) || 0,
    }));
}

/** Personal advice from an aggregated (anonymous) summary of the budget. */
export async function adviceFromSummary(summary) {
  const prompt = `Jesteś rzeczowym, życzliwym doradcą budżetu domowego w Polsce. Na podstawie danych poniżej (kwoty w PLN) napisz po polsku konkretne porady:
1. Krótka ocena sytuacji (2–3 zdania).
2. 3–5 konkretnych rzeczy, na które warto wydawać mniej — z kwotami, ile można zaoszczędzić miesięcznie.
3. Plan na cele oszczędnościowe i długi (jeśli są): ile odkładać miesięcznie i w jakiej kolejności spłacać długi.
4. Jedna szybka rzecz do zrobienia w tym tygodniu.
Pisz zwięźle, w punktach, bez ogólników i bez zastrzeżeń prawnych. Użyj nagłówków „## ”. Nie wymyślaj danych, których nie ma.

Kategorie wydatków: ${EXPENSE_CATS.map((c) => c.name).join(", ")}.

DANE:
${JSON.stringify(summary, null, 1)}`;
  return generate(() => prompt, { temperature: 0.6 });
}
