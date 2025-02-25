import { Box, Text, useInput } from 'ink'
import * as React from 'react'
import { useState, useCallback, useEffect } from 'react'
import { getTheme } from '../utils/theme.js'
import { getMessagesGetter } from '../messages.js'
import type { Message } from '../query.js'
import TextInput from './TextInput.js'
import { logError, getInMemoryErrors } from '../utils/log.js'
import { env } from '../utils/env.js'
import { getGitState, getIsGit, GitRepoState } from '../utils/git.js'
import { useTerminalSize } from '../hooks/useTerminalSize.js'
import { getAnthropicApiKey } from '../utils/config.js'
import { USER_AGENT } from '../utils/http.js'
import { logEvent } from '../services/statsig.js'
import { PRODUCT_NAME } from '../constants/product.js'
import { API_ERROR_MESSAGE_PREFIX, queryHaiku } from '../services/claude.js'
import { openBrowser } from '../utils/browser.js'
import { useExitOnCtrlCD } from '../hooks/useExitOnCtrlCD.js'

const GITHUB_ISSUES_REPO_URL =
  'https://github.com/anthropics/claude-code/issues'

type Props = {
  onDone(result: string): void
}

type Step = 'userInput' | 'consent' | 'submitting' | 'done'

type FeedbackData = {
  // Removing because of privacy concerns. Add this back in when we have a more
  // robust tool for viewing feedback data that can de-identify users
  // user_id: string
  // session_id: string
  message_count: number
  datetime: string
  description: string
  platform: string
  gitRepo: boolean
  version: string | null
  transcript: Message[]
}

export function Bug({ onDone }: Props): React.ReactNode {
  const [step, setStep] = useState<Step>('userInput')
  const [cursorOffset, setCursorOffset] = useState(0)
  const [description, setDescription] = useState('')
  const [feedbackId, setFeedbackId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [envInfo, setEnvInfo] = useState<{
    isGit: boolean
    gitState: GitRepoState | null
  }>({ isGit: false, gitState: null })
  const [title, setTitle] = useState<string | null>(null)
  const textInputColumns = useTerminalSize().columns - 4
  const messages = getMessagesGetter()()

  useEffect(() => {
    async function loadEnvInfo() {
      const isGit = await getIsGit()
      let gitState: GitRepoState | null = null
      if (isGit) {
        gitState = await getGitState()
      }
      setEnvInfo({ isGit, gitState })
    }
    void loadEnvInfo()
  }, [])

  const exitState = useExitOnCtrlCD(() => process.exit(0))

  const submitReport = useCallback(async () => {
    setStep('submitting')
    setError(null)
    setFeedbackId(null)

    const reportData = {
      message_count: messages.length,
      datetime: new Date().toISOString(),
      description,
      platform: env.platform,
      gitRepo: envInfo.isGit,
      terminal: env.terminal,
      version: MACRO.VERSION,
      transcript: messages,
      errors: getInMemoryErrors(),
    }

    const [result, t] = await Promise.all([
      submitFeedback(reportData),
      generateTitle(description),
    ])

    setTitle(t)

    if (result.success) {
      if (result.feedbackId) {
        setFeedbackId(result.feedbackId)
        logEvent('tengu_bug_report_submitted', {
          feedback_id: result.feedbackId,
        })
      }
      setStep('done')
    } else {
      setError('Could not submit feedback. Please try again later.')
      setStep('userInput')
    }
  }, [description, envInfo.isGit, messages])

  useInput((input, key) => {
    // Allow any key press to close the dialog when done or when there's an error
    if (step === 'done') {
      if (key.return && feedbackId && title) {
        // Open GitHub issue URL when Enter is pressed
        const issueUrl = createGitHubIssueUrl(feedbackId, title, description)
        void openBrowser(issueUrl)
      }
      onDone('<bash-stdout>Bug report submitted</bash-stdout>')
      return
    }

    if (error) {
      onDone('<bash-stderr>Error submitting bug report</bash-stderr>')
      return
    }

    if (key.escape) {
      onDone('<bash-stderr>Bug report cancelled</bash-stderr>')
      return
    }

    if (step === 'consent' && (key.return || input === ' ')) {
      void submitReport()
    }
  })

  const theme = getTheme()

  return (
    <>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.permission}
        paddingX={1}
        paddingBottom={1}
        gap={1}
      >
        <Text bold color={theme.permission}>
          Submit Bug Report
        </Text>
        {step === 'userInput' && (
          <Box flexDirection="column" gap={1}>
            <Text>Describe the issue below:</Text>
            <TextInput
              value={description}
              onChange={setDescription}
              columns={textInputColumns}
              onSubmit={() => setStep('consent')}
              onExitMessage={() =>
                onDone('<bash-stderr>Bug report cancelled</bash-stderr>')
              }
              cursorOffset={cursorOffset}
              onChangeCursorOffset={setCursorOffset}
            />
            {error && (
              <Box flexDirection="column" gap={1}>
                <Text color="red">{error}</Text>
                <Text dimColor>Press any key to close</Text>
              </Box>
            )}
          </Box>
        )}

        {step === 'consent' && (
          <Box flexDirection="column">
            <Text>This report will include:</Text>
            <Box marginLeft={2} flexDirection="column">
              <Text>
                - Your bug description: <Text dimColor>{description}</Text>
              </Text>
              <Text>
                - Environment info:{' '}
                <Text dimColor>
                  {env.platform}, {env.terminal}, v{MACRO.VERSION}
                </Text>
              </Text>
              {envInfo.gitState && (
                <Text>
                  - Git repo metadata:{' '}
                  <Text dimColor>
                    {envInfo.gitState.branchName}
                    {envInfo.gitState.commitHash
                      ? `, ${envInfo.gitState.commitHash.slice(0, 7)}`
                      : ''}
                    {envInfo.gitState.remoteUrl
                      ? ` @ ${envInfo.gitState.remoteUrl}`
                      : ''}
                    {!envInfo.gitState.isHeadOnRemote && ', not synced'}
                    {!envInfo.gitState.isClean && ', has local changes'}
                  </Text>
                </Text>
              )}
              <Text>- Current session transcript</Text>
            </Box>
            <Box marginTop={1}>
              <Text wrap="wrap" dimColor>
                We will use your feedback to debug related issues or to improve{' '}
                {PRODUCT_NAME}&apos;s functionality (eg. to reduce the risk of
                bugs occurring in the future). Anthropic will not train
                generative models using feedback from {PRODUCT_NAME}.
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text>
                Press <Text bold>Enter</Text> to confirm and submit.
              </Text>
            </Box>
          </Box>
        )}

        {step === 'submitting' && (
          <Box flexDirection="row" gap={1}>
            <Text>Submitting report…</Text>
          </Box>
        )}

        {step === 'done' && (
          <Box flexDirection="column">
            <Text color={getTheme().success}>Thank you for your report!</Text>
            {feedbackId && <Text dimColor>Feedback ID: {feedbackId}</Text>}
            <Box marginTop={1}>
              <Text>Press </Text>
              <Text bold>Enter </Text>
              <Text>
                to also create a GitHub issue, or any other key to close.
              </Text>
            </Box>
          </Box>
        )}
      </Box>

      <Box marginLeft={3}>
        <Text dimColor>
          {exitState.pending ? (
            <>Press {exitState.keyName} again to exit</>
          ) : step === 'userInput' ? (
            <>Enter to continue · Esc to cancel</>
          ) : step === 'consent' ? (
            <>Enter to submit · Esc to cancel</>
          ) : null}
        </Text>
      </Box>
    </>
  )
}

function createGitHubIssueUrl(
  feedbackId: string,
  title: string,
  description: string,
): string {
  const body = encodeURIComponent(
    `**Bug Description**\n${description}\n\n` +
      `**Environment Info**\n` +
      `- Platform: ${env.platform}\n` +
      `- Terminal: ${env.terminal}\n` +
      `- Version: ${MACRO.VERSION || 'unknown'}\n` +
      `- Feedback ID: ${feedbackId}\n`,
  )
  return `${GITHUB_ISSUES_REPO_URL}/new?title=${encodeURIComponent(title)}&body=${body}&labels=user-reported,bug`
}

async function generateTitle(description: string): Promise<string> {
  const response = await queryHaiku({
    systemPrompt: [
      'Generate a concise issue title (max 80 chars) that captures the key point of this feedback. Do not include quotes or prefixes like "Feedback:" or "Issue:". If you cannot generate a title, just use "User Feedback".',
    ],
    userPrompt: description,
  })
  const title =
    response.message.content[0]?.type === 'text'
      ? response.message.content[0].text
      : 'Bug Report'
  if (title.startsWith(API_ERROR_MESSAGE_PREFIX)) {
    return `Bug Report: ${description.slice(0, 60)}${description.length > 60 ? '...' : ''}`
  }
  return title
}

async function submitFeedback(
  data: FeedbackData,
): Promise<{ success: boolean; feedbackId?: string }> {
  try {
    const apiKey = getAnthropicApiKey()
    if (!apiKey) {
      return { success: false }
    }

    const response = await fetch(
      'https://api.anthropic.com/api/claude_cli_feedback',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          content: JSON.stringify(data),
        }),
      },
    )

    if (response.ok) {
      const result = await response.json()
      if (result?.feedback_id) {
        return { success: true, feedbackId: result.feedback_id }
      }
      logError('Failed to submit feedback: request did not return feedback_id')
      return { success: false }
    }

    logError('Failed to submit feedback:' + response.status)
    return { success: false }
  } catch (err) {
    logError(
      'Error submitting feedback: ' +
        (err instanceof Error ? err.message : 'Unknown error'),
    )
    return { success: false }
  }
}
