import { useCallback, useMemo } from "react"
import { motion } from "framer-motion"
import {
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
} from "lucide-react"

import { useCanvasStore } from "../store/canvasStore"

type OnboardingStep =
  | "welcome"
  | "add-box"
  | "select-box"
  | "enter-prompt"
  | "generate-image"
  | "resize-box"
  | "complete"

export default function Onboarding() {
  const { onboardingStep, setOnboardingStep, completeOnboarding } =
    useCanvasStore()

  const steps: OnboardingStep[] = useMemo(
    () => [
      "welcome",
      "add-box",
      "select-box",
      "enter-prompt",
      "generate-image",
      "resize-box",
      "complete",
    ],
    []
  )

  const getStepConfig = (step: OnboardingStep) => {
    switch (step) {
      case "welcome":
        return {
          title: "Welcome to Image Generation!",
          description:
            "Let's walk through how to create amazing images with AI. This will only take a few minutes.",
          position: { x: 50, y: 50 },
          showArrow: false,
        }

      case "add-box":
        return {
          title: "Step 1: Add a Canvas Box",
          description:
            "First, let's add a canvas box where your image will be generated. Click the '+' button in the toolbar.",
          position: { x: 50, y: 200 },
          showArrow: true,
          arrowDirection: "down" as const,
          highlightElement: "[data-toolbar-add]",
        }

      case "select-box":
        return {
          title: "Step 2: Select the Box",
          description:
            "Click on the box you just created to select it. You'll see it highlighted with a blue border.",
          position: { x: 300, y: 200 },
          showArrow: true,
          arrowDirection: "right" as const,
          highlightElement: ".canvas-box",
        }

      case "enter-prompt":
        return {
          title: "Step 3: Enter Your Prompt",
          description:
            "Type your image description in the prompt box at the bottom. Be creative and descriptive!",
          position: { x: 50, y: 400 },
          showArrow: true,
          arrowDirection: "down" as const,
          highlightElement: "[data-prompt-input]",
        }

      case "generate-image":
        return {
          title: "Step 4: Generate Your Image",
          description:
            "Click the generate button to create your AI image. This may take a few moments.",
          position: { x: 200, y: 400 },
          showArrow: true,
          arrowDirection: "right" as const,
          highlightElement: "[data-generate-button]",
        }

      case "resize-box":
        return {
          title: "Step 5: Resize Your Box",
          description:
            "Drag the corner handles to resize your box. You can also move it around the canvas.",
          position: { x: 400, y: 200 },
          showArrow: true,
          arrowDirection: "left" as const,
          highlightElement: ".canvas-box",
        }

      case "complete":
        return {
          title: "You're All Set!",
          description:
            "You've learned the basics! You can now create, customize, and generate images. Have fun creating!",
          position: { x: 50, y: 50 },
          showArrow: false,
        }

      default:
        return null
    }
  }

  const handleNext = useCallback(() => {
    if (!onboardingStep) return

    const currentIndex = steps.indexOf(onboardingStep)
    const nextIndex = currentIndex + 1

    if (nextIndex >= steps.length) {
      completeOnboarding()
    } else {
      setOnboardingStep(steps[nextIndex])
    }
  }, [onboardingStep, steps, setOnboardingStep, completeOnboarding])

  const handlePrevious = useCallback(() => {
    if (!onboardingStep) return

    const currentIndex = steps.indexOf(onboardingStep)
    const prevIndex = currentIndex - 1

    if (prevIndex >= 0) {
      setOnboardingStep(steps[prevIndex])
    }
  }, [onboardingStep, steps, setOnboardingStep])

  const handleSkip = useCallback(() => {
    completeOnboarding()
  }, [completeOnboarding])

  const stepConfig = onboardingStep ? getStepConfig(onboardingStep) : null
  const canGoBack = onboardingStep !== "welcome"
  const isLastStep = onboardingStep === "complete"

  if (!onboardingStep || !stepConfig) {
    return null
  }

  return (
    <div className="absolute top-0 left-0 w-full h-full z-[110] pointer-events-auto">
      {/* Backdrop overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Highlight overlay for specific elements */}
      {stepConfig.highlightElement && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-black/30" />
        </div>
      )}

      {/* Onboarding content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        layoutId="onboarding-content"
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="absolute bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-white/20 p-6 max-w-sm"
        style={{
          left: stepConfig.position.x,
          top: stepConfig.position.y,
        }}
      >
        {/* Arrow pointing to element */}
        {stepConfig.showArrow && stepConfig.arrowDirection && (
          <div className="absolute text-indigo-500">
            {(stepConfig.arrowDirection as string) === "up" && (
              <ArrowUp className="w-6 h-6 -top-8 left-1/2 -translate-x-1/2" />
            )}
            {stepConfig.arrowDirection === "down" && (
              <ArrowDown className="w-6 h-6 -bottom-8 left-1/2 -translate-x-1/2" />
            )}
            {stepConfig.arrowDirection === "left" && (
              <ArrowLeft className="w-6 h-6 -left-8 top-1/2 -translate-y-1/2" />
            )}
            {stepConfig.arrowDirection === "right" && (
              <ArrowRight className="w-6 h-6 -right-8 top-1/2 -translate-y-1/2" />
            )}
          </div>
        )}

        {/* Content */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {stepConfig.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {stepConfig.description}
              </p>
            </div>
            <button
              onClick={handleSkip}
              className="ml-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress indicator */}
          <div className="flex space-x-1">
            {steps.map((step, _index) => (
              <div
                key={step}
                className={`h-1 flex-1 rounded ${
                  onboardingStep === step ? "bg-indigo-500" : "bg-gray-200"
                }`}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex space-x-2">
              {canGoBack && (
                <button
                  onClick={handlePrevious}
                  className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
              )}
            </div>

            <button
              onClick={handleNext}
              className="flex items-center space-x-1 px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors"
            >
              <span>{isLastStep ? "Finish" : "Next"}</span>
              {!isLastStep && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
