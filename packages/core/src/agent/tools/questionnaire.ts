import type { ToolHandler, QuestionnaireQuestion } from "../types.js";

export const questionnaireTool: ToolHandler = {
  definition: {
    name: "questionnaire",
    description:
      "Present a multi-step questionnaire to the user to collect structured information. Use this when you need to gather multiple related pieces of information in an organized way.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the questionnaire (e.g., 'Project Setup')",
        },
        description: {
          type: "string",
          description:
            "Optional description explaining the purpose of the questionnaire",
        },
        questions: {
          type: "array",
          description: "Array of questions to ask the user",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description:
                  "Unique identifier for this question (e.g., 'framework', 'budget')",
              },
              question: {
                type: "string",
                description: "The question to ask",
              },
              type: {
                type: "string",
                enum: ["single", "multiple", "text", "textarea"],
                description:
                  "Question type: 'single' (radio), 'multiple' (checkboxes), 'text' (short input), 'textarea' (long input)",
              },
              options: {
                type: "array",
                description:
                  "Options for single/multiple choice questions (not needed for text/textarea)",
                items: {
                  type: "object",
                  properties: {
                    value: {
                      type: "string",
                      description: "The value returned when selected",
                    },
                    label: {
                      type: "string",
                      description: "Display text for this option",
                    },
                    description: {
                      type: "string",
                      description:
                        "Optional description explaining this option",
                    },
                  },
                  required: ["value", "label"],
                },
              },
              required: {
                type: "boolean",
                description:
                  "Whether this question must be answered (default: false)",
              },
              placeholder: {
                type: "string",
                description: "Placeholder text for text/textarea inputs",
              },
              allowOther: {
                type: "boolean",
                description:
                  "For single/multiple choice: add an 'Other' option with text input",
              },
            },
            required: ["id", "question", "type"],
          },
        },
      },
      required: ["questions"],
    },
  },
  async execute(args, context) {
    const title = (args.title as string) || "Questionnaire";
    const description = args.description as string | undefined;
    const questions = args.questions as QuestionnaireQuestion[];

    if (!questions || questions.length === 0) {
      return {
        toolCallId: "",
        content: "Error: No questions provided",
        isError: true,
      };
    }

    // Request the questionnaire from the user
    const responses = await context.requestQuestionnaire({
      id: `questionnaire_${Date.now()}`,
      title,
      description,
      questions,
    });

    // Format the responses as a readable summary
    if (Object.keys(responses).length === 0) {
      return {
        toolCallId: "",
        content: "User skipped the questionnaire (no responses provided)",
      };
    }

    const summary: string[] = [];
    for (const question of questions) {
      const response = responses[question.id];
      if (response !== undefined) {
        let value: string;
        if (Array.isArray(response)) {
          value = response.join(", ");
        } else {
          value = String(response);
        }
        summary.push(`**${question.question}:** ${value}`);
      }
    }

    return {
      toolCallId: "",
      content: summary.join("\n"),
    };
  },
};
