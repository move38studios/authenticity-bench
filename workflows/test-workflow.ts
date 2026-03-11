import { sleep } from "workflow";

interface TestWorkflowInput {
  modelId: string;
  prompt: string;
}

interface StepResult {
  step: string;
  result: unknown;
  timestamp: string;
}

export async function testWorkflow(input: TestWorkflowInput) {
  "use workflow";

  const log: StepResult[] = [];

  // Step 1: Validate input
  const validation = await validateInput(input);
  log.push({ step: "validate", result: validation, timestamp: new Date().toISOString() });

  // Step 2: Sleep to test durability
  await sleep("3s");
  log.push({ step: "sleep", result: "slept 3s", timestamp: new Date().toISOString() });

  // Step 3: Make an LLM call
  const llmResult = await callLLM(input.modelId, input.prompt);
  log.push({ step: "llm_call", result: llmResult, timestamp: new Date().toISOString() });

  // Step 4: Simulate a batch of parallel work
  const [batchA, batchB, batchC] = await Promise.all([
    doWork("batch-a"),
    doWork("batch-b"),
    doWork("batch-c"),
  ]);
  log.push({
    step: "parallel_batch",
    result: { batchA, batchB, batchC },
    timestamp: new Date().toISOString(),
  });

  return {
    status: "completed",
    steps: log.length,
    log,
  };
}

async function validateInput(input: TestWorkflowInput) {
  "use step";
  if (!input.modelId) throw new Error("modelId is required");
  if (!input.prompt) throw new Error("prompt is required");
  return { valid: true, modelId: input.modelId, promptLength: input.prompt.length };
}

async function callLLM(modelId: string, prompt: string) {
  "use step";
  // Dynamic import to avoid bundling issues with workflow compiler
  const { getModel } = await import("@/lib/services/llm");
  const { generateText } = await import("ai");

  const model = await getModel(modelId);
  const result = await generateText({
    model,
    prompt,
    temperature: 0.7,
  });

  return {
    text: result.text.slice(0, 500),
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
    finishReason: result.finishReason,
  };
}

async function doWork(label: string) {
  "use step";
  // Simulate some work
  const start = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 100));
  return { label, durationMs: Date.now() - start };
}
