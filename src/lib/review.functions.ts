import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateReviewInput = z.object({
  filename: z.string().min(1).max(300),
  fileType: z.string().max(50),
  text: z.string().min(20).max(400_000),
  pageCount: z.number().int().nonnegative().max(10_000),
  wordCount: z.number().int().nonnegative().max(2_000_000),
});

const SYSTEM_PROMPT = `You are a senior legal analyst AI assistant. You review contracts and legal documents with precision, identifying risks, missing clauses, compliance gaps, and providing actionable recommendations. You always output structured JSON matching the requested schema. You do not provide legal advice — you flag issues for review by licensed attorneys.`;

const REVIEW_INSTRUCTIONS = `Review the following contract and produce TWO JSON objects merged into one response with this exact top-level shape:

{
  "summary": "2-3 sentence executive summary",
  "documentType": "NDA | SaaS Agreement | Employment | MSA | Service Agreement | Other",
  "overallRisk": "high | medium | low",
  "clauses": [
    {
      "title": "clause name",
      "extractedText": "verbatim excerpt (max 240 chars)",
      "riskLevel": "high | medium | low | info",
      "finding": "what the issue is (1-2 sentences)",
      "recommendation": "suggested fix or alternative language"
    }
  ],
  "missingClauses": ["list of expected but absent clauses"],
  "prohibitedTerms": ["list of found prohibited or unusual terms"],
  "complianceIssues": ["list of compliance gaps"],
  "briefing": {
    "headline": "one-sentence verdict for non-legal stakeholders",
    "keyPoints": ["up to 5 bullet points in plain English"],
    "topRisks": ["up to 3 risks in plain language"],
    "recommendation": "sign | negotiate | reject | escalate",
    "recommendationReason": "2-sentence explanation"
  }
}

Return ONLY valid JSON. No markdown fences, no preamble. Include between 4 and 12 clauses, focusing on the most important ones (liability, indemnity, IP, termination, confidentiality, payment, jurisdiction, data, warranties).`;

type ReviewResult = {
  summary: string;
  documentType: string;
  overallRisk: "high" | "medium" | "low";
  clauses: Array<{
    title: string;
    extractedText: string;
    riskLevel: "high" | "medium" | "low" | "info";
    finding: string;
    recommendation: string;
  }>;
  missingClauses: string[];
  prohibitedTerms: string[];
  complianceIssues: string[];
  briefing: {
    headline: string;
    keyPoints: string[];
    topRisks: string[];
    recommendation: "sign" | "negotiate" | "reject" | "escalate";
    recommendationReason: string;
  };
};

export const createReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateReviewInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Insert document
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .insert({
        user_id: userId,
        filename: data.filename,
        file_type: data.fileType,
        word_count: data.wordCount,
        page_count: data.pageCount,
      })
      .select()
      .single();
    if (docErr || !doc) throw new Error(docErr?.message ?? "Failed to save document");

    // 2. Insert pending review
    const { data: review, error: revErr } = await supabase
      .from("reviews")
      .insert({
        user_id: userId,
        document_id: doc.id,
        status: "processing",
      })
      .select()
      .single();
    if (revErr || !review) throw new Error(revErr?.message ?? "Failed to create review");

    // 3. Call Anthropic (do this synchronously so the redirect lands on a ready page)
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });
      const truncated = data.text.length > 180_000 ? data.text.slice(0, 180_000) : data.text;

      const message = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `${REVIEW_INSTRUCTIONS}\n\nFilename: ${data.filename}\n\nCONTRACT TEXT:\n${truncated}`,
          },
        ],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      const raw = textBlock && "text" in textBlock ? textBlock.text : "";
      const json = extractJson(raw);
      const parsed = JSON.parse(json) as ReviewResult;

      await supabase
        .from("reviews")
        .update({
          status: "complete",
          overall_risk: parsed.overallRisk,
          result_json: parsed,
        })
        .eq("id", review.id);

      return { reviewId: review.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Review failed:", msg);
      await supabase
        .from("reviews")
        .update({ status: "error", error_message: msg })
        .eq("id", review.id);
      return { reviewId: review.id };
    }
  });

function extractJson(s: string): string {
  // Strip ```json fences if present, then find the outermost {...}.
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : s;
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  if (first === -1 || last === -1) return body;
  return body.slice(first, last + 1);
}

export const getReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: review, error } = await context.supabase
      .from("reviews")
      .select("id, status, overall_risk, result_json, error_message, created_at, document_id, documents(filename, file_type, word_count, page_count)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!review) throw new Error("Review not found");
    return review;
  });

export const listRecentReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("reviews")
      .select("id, status, overall_risk, created_at, documents(filename, file_type)")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
