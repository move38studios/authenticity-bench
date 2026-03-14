/**
 * viewimage tool — Let the agent inspect a generated chart
 *
 * The actual image injection happens via prepareStep in the chat route,
 * which appends image URLs as user message content parts so the LLM sees them.
 */

import { tool } from "ai";
import { z } from "zod/v4";

export const viewImageTool = tool({
  description:
    "View a generated image/chart to verify it looks correct. Pass the URL of an image produced by execute_python. The image will be displayed so you can check the visualization and course-correct if needed.",
  inputSchema: z.object({
    url: z.string().describe("The URL of the image to view"),
  }),
  execute: async ({ url }) => {
    // Validate it's an image URL by checking the extension or content type
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (!response.ok) {
        return { success: false, error: `Could not fetch image: ${response.status}` };
      }

      const contentType = response.headers.get("content-type") ?? "";
      const size = response.headers.get("content-length");

      return {
        success: true,
        url,
        contentType,
        size: size ? parseInt(size) : null,
        message: "Image loaded for inspection. Review the visualization and suggest improvements if needed.",
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to access image: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});
