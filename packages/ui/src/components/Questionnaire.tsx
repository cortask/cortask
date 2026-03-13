import { useState } from "react";
import { ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface QuestionnaireQuestion {
  id: string;
  question: string;
  type: "single" | "multiple" | "text" | "textarea";
  options?: QuestionnaireOption[];
  required?: boolean;
  placeholder?: string;
  allowOther?: boolean; // Show "Other" option with text input
}

export interface QuestionnaireOption {
  value: string;
  label: string;
  description?: string;
}

export interface QuestionnaireData {
  requestId: string;
  title?: string;
  description?: string;
  questions: QuestionnaireQuestion[];
}

export interface QuestionnaireResponses {
  [questionId: string]: string | string[];
}

interface QuestionnaireProps {
  data: QuestionnaireData;
  onSubmit: (responses: QuestionnaireResponses) => void;
  onSkip?: () => void;
  isResolved?: boolean;
  submittedResponses?: QuestionnaireResponses;
}

export function Questionnaire({
  data,
  onSubmit,
  onSkip,
  isResolved = false,
  submittedResponses,
}: QuestionnaireProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<QuestionnaireResponses>(
    submittedResponses || {},
  );
  const [otherText, setOtherText] = useState<Record<string, string>>({});

  const currentQuestion = data.questions[currentStep];
  const isLastStep = currentStep === data.questions.length - 1;
  const isFirstStep = currentStep === 0;
  const totalSteps = data.questions.length;

  const handleSingleSelect = (value: string) => {
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
    // Clear other text if not selecting "Other"
    if (value !== "__other__") {
      setOtherText((prev) => {
        const updated = { ...prev };
        delete updated[currentQuestion.id];
        return updated;
      });
    }
  };

  const handleMultiSelect = (value: string) => {
    setResponses((prev) => {
      const current = (prev[currentQuestion.id] as string[]) || [];
      const newValue = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return {
        ...prev,
        [currentQuestion.id]: newValue,
      };
    });
  };

  const handleTextInput = (value: string) => {
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  };

  const handleNext = () => {
    // Replace __other__ with actual text
    const finalResponses = { ...responses };
    Object.keys(finalResponses).forEach((qId) => {
      const value = finalResponses[qId];
      if (value === "__other__" && otherText[qId]) {
        finalResponses[qId] = otherText[qId];
      } else if (
        Array.isArray(value) &&
        value.includes("__other__") &&
        otherText[qId]
      ) {
        finalResponses[qId] = value
          .filter((v) => v !== "__other__")
          .concat(otherText[qId]);
      }
    });

    if (isLastStep) {
      onSubmit(finalResponses);
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSkipCurrent = () => {
    if (isLastStep) {
      onSubmit(responses);
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleSkipAll = () => {
    if (onSkip) {
      onSkip();
    } else {
      onSubmit({});
    }
  };

  const currentResponse = responses[currentQuestion.id];
  const isOtherSelected =
    currentResponse === "__other__" ||
    (Array.isArray(currentResponse) && currentResponse.includes("__other__"));
  const otherTextValue = otherText[currentQuestion.id] || "";

  const canProceed =
    !currentQuestion.required ||
    (currentResponse !== undefined &&
      currentResponse !== "" &&
      (Array.isArray(currentResponse)
        ? currentResponse.length > 0
        : true) &&
      // If "Other" is selected, require text input
      (!isOtherSelected || otherTextValue.trim() !== ""));

  // Resolved state - show summary
  if (isResolved && submittedResponses) {
    return (
      <div className="flex gap-3">
        <div className="w-7 shrink-0" />
        <div className="flex items-center gap-2">
          <span className="flex h-3.5 w-3.5 items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="text-xs text-muted-foreground">
            Questionnaire completed
            {Object.keys(submittedResponses).length > 0
              ? ` (${Object.keys(submittedResponses).length} ${Object.keys(submittedResponses).length === 1 ? "answer" : "answers"})`
              : " (skipped)"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="w-7 shrink-0" />
      <Card className="max-w-[80%] w-full border-blue-500/30">
        <CardContent className="px-4 py-3 space-y-3">
          {/* Header */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-blue-500">
                {data.title || "Questionnaire"}
              </p>
              <span className="text-xs text-muted-foreground">
                {currentStep + 1} of {totalSteps}
              </span>
            </div>
            {data.description && (
              <p className="text-xs text-muted-foreground">
                {data.description}
              </p>
            )}
          </div>

          {/* Question */}
          <div className="space-y-2">
            <p className="text-sm font-medium leading-relaxed">
              {currentQuestion.question}
            </p>

            {/* Single choice */}
            {currentQuestion.type === "single" &&
              currentQuestion.options && (
                <div className="space-y-1.5">
                  {currentQuestion.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSingleSelect(option.value)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md border transition-colors",
                        responses[currentQuestion.id] === option.value
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex items-center justify-center h-4 w-4 mt-0.5 shrink-0">
                          <div
                            className={cn(
                              "h-3 w-3 rounded-full border-2 flex items-center justify-center",
                              responses[currentQuestion.id] === option.value
                                ? "border-blue-500"
                                : "border-muted-foreground",
                            )}
                          >
                            {responses[currentQuestion.id] ===
                              option.value && (
                              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{option.label}</p>
                          {option.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {option.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                  {/* Other option */}
                  {currentQuestion.allowOther && (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => handleSingleSelect("__other__")}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md border transition-colors",
                          responses[currentQuestion.id] === "__other__"
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-border hover:bg-muted/50",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex items-center justify-center h-4 w-4 mt-0.5 shrink-0">
                            <div
                              className={cn(
                                "h-3 w-3 rounded-full border-2 flex items-center justify-center",
                                responses[currentQuestion.id] === "__other__"
                                  ? "border-blue-500"
                                  : "border-muted-foreground",
                              )}
                            >
                              {responses[currentQuestion.id] ===
                                "__other__" && (
                                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">Other</p>
                          </div>
                        </div>
                      </button>
                      {responses[currentQuestion.id] === "__other__" && (
                        <Input
                          type="text"
                          placeholder="Please specify..."
                          value={otherText[currentQuestion.id] || ""}
                          onChange={(e) =>
                            setOtherText((prev) => ({
                              ...prev,
                              [currentQuestion.id]: e.target.value,
                            }))
                          }
                          className="text-sm"
                          autoFocus
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

            {/* Multiple choice */}
            {currentQuestion.type === "multiple" &&
              currentQuestion.options && (
                <div className="space-y-1.5">
                  {currentQuestion.options.map((option) => {
                    const isSelected = (
                      (responses[currentQuestion.id] as string[]) || []
                    ).includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleMultiSelect(option.value)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md border transition-colors",
                          isSelected
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-border hover:bg-muted/50",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex items-center justify-center h-4 w-4 mt-0.5 shrink-0">
                            <div
                              className={cn(
                                "h-3 w-3 rounded-sm border-2 flex items-center justify-center",
                                isSelected
                                  ? "border-blue-500 bg-blue-500"
                                  : "border-muted-foreground",
                              )}
                            >
                              {isSelected && (
                                <svg
                                  className="h-2 w-2 text-white"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{option.label}</p>
                            {option.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {option.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {/* Other option for multiple choice */}
                  {currentQuestion.allowOther && (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => handleMultiSelect("__other__")}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md border transition-colors",
                          (
                            (responses[currentQuestion.id] as string[]) || []
                          ).includes("__other__")
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-border hover:bg-muted/50",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex items-center justify-center h-4 w-4 mt-0.5 shrink-0">
                            <div
                              className={cn(
                                "h-3 w-3 rounded-sm border-2 flex items-center justify-center",
                                (
                                  (responses[currentQuestion.id] as string[]) ||
                                  []
                                ).includes("__other__")
                                  ? "border-blue-500 bg-blue-500"
                                  : "border-muted-foreground",
                              )}
                            >
                              {(
                                (responses[currentQuestion.id] as string[]) ||
                                []
                              ).includes("__other__") && (
                                <svg
                                  className="h-2 w-2 text-white"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">Other</p>
                          </div>
                        </div>
                      </button>
                      {(
                        (responses[currentQuestion.id] as string[]) || []
                      ).includes("__other__") && (
                        <Input
                          type="text"
                          placeholder="Please specify..."
                          value={otherText[currentQuestion.id] || ""}
                          onChange={(e) =>
                            setOtherText((prev) => ({
                              ...prev,
                              [currentQuestion.id]: e.target.value,
                            }))
                          }
                          className="text-sm"
                          autoFocus
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

            {/* Text input */}
            {currentQuestion.type === "text" && (
              <Input
                type="text"
                placeholder={currentQuestion.placeholder || "Type your answer"}
                value={
                  (responses[currentQuestion.id] as string | undefined) || ""
                }
                onChange={(e) => handleTextInput(e.target.value)}
                className="text-sm"
              />
            )}

            {/* Textarea input */}
            {currentQuestion.type === "textarea" && (
              <Textarea
                placeholder={currentQuestion.placeholder || "Type your answer"}
                value={
                  (responses[currentQuestion.id] as string | undefined) || ""
                }
                onChange={(e) => handleTextInput(e.target.value)}
                className="text-sm min-h-[80px]"
                rows={3}
              />
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex gap-2">
              {!isFirstStep && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleBack}
                >
                  <ChevronLeft className="h-3 w-3 mr-1" />
                  Back
                </Button>
              )}
              {isFirstStep && totalSteps > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSkipAll}
                >
                  <SkipForward className="h-3 w-3 mr-1" />
                  Skip All
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              {!currentQuestion.required && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSkipCurrent}
                >
                  Skip
                </Button>
              )}
              <Button
                size="sm"
                className="h-7 text-xs bg-blue-600 hover:bg-blue-500 text-white"
                onClick={handleNext}
                disabled={!canProceed}
              >
                {isLastStep ? "Submit" : "Next"}
                {!isLastStep && <ChevronRight className="h-3 w-3 ml-1" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
