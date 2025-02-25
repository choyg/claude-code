import React, { useMemo, useState } from 'react'
import { PRODUCT_NAME } from '../constants/product.js'
import { Box, Newline, Text, useInput } from 'ink'
import {
  getGlobalConfig,
  saveGlobalConfig,
  getCustomApiKeyStatus,
  normalizeApiKeyForConfig,
  DEFAULT_GLOBAL_CONFIG,
} from '../utils/config.js'
import { OrderedList } from '@inkjs/ui'
import { useExitOnCtrlCD } from '../hooks/useExitOnCtrlCD.js'
import { MIN_LOGO_WIDTH } from './Logo.js'
import { ConsoleOAuthFlow } from './ConsoleOAuthFlow.js'
import { ApproveApiKey } from './ApproveApiKey.js'
import { Select } from './CustomSelect/index.js'
import { StructuredDiff } from './StructuredDiff.js'
import { getTheme, ThemeNames } from '../utils/theme.js'
import { isAnthropicAuthEnabled } from '../utils/auth.js'
import Link from './Link.js'
import { clearTerminal } from '../utils/terminal.js'
import { PressEnterToContinue } from './PressEnterToContinue.js'

type StepId = 'theme' | 'oauth' | 'api-key' | 'usage' | 'security'

interface OnboardingStep {
  id: StepId
  component: React.ReactNode
}

type Props = {
  onDone(): void
}

export function Onboarding({ onDone }: Props): React.ReactNode {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const config = getGlobalConfig()
  const oauthEnabled = isAnthropicAuthEnabled()
  const [selectedTheme, setSelectedTheme] = useState(
    DEFAULT_GLOBAL_CONFIG.theme,
  )
  const theme = getTheme()
  function goToNextStep() {
    if (currentStepIndex < steps.length - 1) {
      const nextIndex = currentStepIndex + 1
      setCurrentStepIndex(nextIndex)
    }
  }

  function handleThemeSelection(newTheme: string) {
    saveGlobalConfig({
      ...config,
      theme: newTheme as ThemeNames,
    })
    goToNextStep()
  }

  function handleThemePreview(newTheme: string) {
    setSelectedTheme(newTheme as ThemeNames)
  }

  const exitState = useExitOnCtrlCD(() => process.exit(0))

  useInput(async (_, key) => {
    const currentStep = steps[currentStepIndex]
    if (
      key.return &&
      currentStep &&
      ['usage', 'security'].includes(currentStep.id)
    ) {
      if (currentStepIndex === steps.length - 1) {
        onDone()
      } else {
        // HACK: for some reason there's now a jump here otherwise :(
        if (currentStep.id === 'security') {
          await clearTerminal()
        }
        goToNextStep()
      }
    }
  })

  // Define all onboarding steps
  const themeStep = (
    <Box flexDirection="column" gap={1} paddingLeft={1}>
      <Text>Let&apos;s get started.</Text>
      <Box flexDirection="column">
        <Text bold>Choose the option that looks best when you select it:</Text>
        <Text dimColor>To change this later, run /config</Text>
      </Box>
      <Select
        options={[
          { label: 'Light text', value: 'dark' },
          { label: 'Dark text', value: 'light' },
          {
            label: 'Light text (colorblind-friendly)',
            value: 'dark-daltonized',
          },
          {
            label: 'Dark text (colorblind-friendly)',
            value: 'light-daltonized',
          },
        ]}
        onFocus={handleThemePreview}
        onChange={handleThemeSelection}
      />
      <Box flexDirection="column">
        <Box
          paddingLeft={1}
          marginRight={1}
          borderStyle="round"
          borderColor="gray"
          flexDirection="column"
        >
          <StructuredDiff
            patch={{
              oldStart: 1,
              newStart: 1,
              oldLines: 3,
              newLines: 3,
              lines: [
                'function greet() {',
                '-  console.log("Hello, World!");',
                '+  console.log("Hello, Claude!");',
                '}',
              ],
            }}
            dim={false}
            width={40}
            overrideTheme={selectedTheme}
          />
        </Box>
      </Box>
    </Box>
  )

  const securityStep = (
    <Box flexDirection="column" gap={1} paddingLeft={1}>
      <Text bold>Security notes:</Text>
      <Box flexDirection="column" width={70}>
        <OrderedList>
          <OrderedList.Item>
            <Text>Claude Code is currently in research preview</Text>
            <Text color={theme.secondaryText} wrap="wrap">
              This beta version may have limitations or unexpected behaviors.
              <Newline />
              Run /bug at any time to report issues.
              <Newline />
            </Text>
          </OrderedList.Item>
          <OrderedList.Item>
            <Text>Claude can make mistakes</Text>
            <Text color={theme.secondaryText} wrap="wrap">
              You should always review Claude&apos;s responses, especially when
              <Newline />
              running code.
              <Newline />
            </Text>
          </OrderedList.Item>
          <OrderedList.Item>
            <Text>
              Due to prompt injection risks, only use it with code you trust
            </Text>
            <Text color={theme.secondaryText} wrap="wrap">
              For more details see:
              <Newline />
              <Link url="https://docs.anthropic.com/s/claude-code-security" />
            </Text>
          </OrderedList.Item>
        </OrderedList>
      </Box>
      <PressEnterToContinue />
    </Box>
  )

  const usageStep = (
    <Box flexDirection="column" gap={1} paddingLeft={1}>
      <Text bold>Using {PRODUCT_NAME} effectively:</Text>
      <Box flexDirection="column" width={70}>
        <OrderedList>
          <OrderedList.Item>
            <Text>
              Start in your project directory
              <Newline />
              <Text color={theme.secondaryText}>
                Files are automatically added to context when needed.
              </Text>
              <Newline />
            </Text>
          </OrderedList.Item>
          <OrderedList.Item>
            <Text>
              Use {PRODUCT_NAME} as a development partner
              <Newline />
              <Text color={theme.secondaryText}>
                Get help with file analysis, editing, bash commands,
                <Newline />
                and git history.
                <Newline />
              </Text>
            </Text>
          </OrderedList.Item>
          <OrderedList.Item>
            <Text>
              Provide clear context
              <Newline />
              <Text color={theme.secondaryText}>
                Be as specific as you would with another engineer. <Newline />
                The better the context, the better the results. <Newline />
              </Text>
            </Text>
          </OrderedList.Item>
        </OrderedList>
        <Box>
          <Text>
            For more details on {PRODUCT_NAME}, see:
            <Newline />
            <Link url={MACRO.README_URL} />
          </Text>
        </Box>
      </Box>
      <PressEnterToContinue />
    </Box>
  )

  // Create the steps array - determine which steps to include based on reAuth and oauthEnabled
  const apiKeyNeedingApproval = useMemo(() => {
    if (process.env.USER_TYPE !== 'ant') {
      return ''
    }
    // Add API key step if needed
    if (!process.env.ANTHROPIC_API_KEY) {
      return ''
    }
    const customApiKeyTruncated = normalizeApiKeyForConfig(
      process.env.ANTHROPIC_API_KEY!,
    )
    if (getCustomApiKeyStatus(customApiKeyTruncated) === 'new') {
      return customApiKeyTruncated
    }
  }, [])

  const steps: OnboardingStep[] = []
  steps.push({ id: 'theme', component: themeStep })

  // Add OAuth step if Anthropic auth is enabled and user is not logged in
  if (oauthEnabled) {
    steps.push({
      id: 'oauth',
      component: <ConsoleOAuthFlow onDone={goToNextStep} />,
    })
  }

  // Add API key step if needed
  if (apiKeyNeedingApproval) {
    steps.push({
      id: 'api-key',
      component: (
        <ApproveApiKey
          customApiKeyTruncated={apiKeyNeedingApproval}
          onDone={goToNextStep}
        />
      ),
    })
  }

  // Add security step
  steps.push({ id: 'security', component: securityStep })

  // Add usage step as the last content step
  steps.push({ id: 'usage', component: usageStep })
  return (
    <Box flexDirection="column" gap={1}>
      {/* OAuth uses static rendering so we need to hide welcome box here
          and re-render it inside ConsoleOAuthFlow to preserve layout */}
      {steps[currentStepIndex]?.id !== 'oauth' && <WelcomeBox />}
      <Box flexDirection="column" padding={0} gap={0}>
        {steps[currentStepIndex]?.component}
        {exitState.pending && (
          <Box padding={1}>
            <Text dimColor>Press {exitState.keyName} again to exit</Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export function WelcomeBox(): React.ReactNode {
  const theme = getTheme()
  return (
    <Box
      borderColor={theme.claude}
      borderStyle="round"
      paddingX={1}
      width={MIN_LOGO_WIDTH}
    >
      <Text>
        <Text color={theme.claude}>✻</Text> Welcome to{' '}
        <Text bold>{PRODUCT_NAME}</Text> research preview!
      </Text>
    </Box>
  )
}
