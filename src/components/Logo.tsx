import { Box, Text } from 'ink'
import * as React from 'react'
import { getTheme } from '../utils/theme.js'
import { PRODUCT_NAME } from '../constants/product.js'
import { isDefaultApiKey, getAnthropicApiKey } from '../utils/config.js'
import { getCwd } from '../utils/state.js'
import type { WrappedClient } from '../services/mcpClient.js'

export const MIN_LOGO_WIDTH = 46

export function Logo({
  mcpClients,
  isDefaultModel = false,
}: {
  mcpClients: WrappedClient[]
  isDefaultModel?: boolean
}): React.ReactNode {
  const width = Math.max(MIN_LOGO_WIDTH, getCwd().length + 12)
  const theme = getTheme()
  const currentModel = process.env.ANTHROPIC_MODEL
  const apiKey = getAnthropicApiKey()
  const isCustomApiKey = !isDefaultApiKey()
  const isCustomModel = !isDefaultModel && Boolean(currentModel)
  const hasOverrides =
    process.env.USER_TYPE === 'ant' &&
    Boolean(
      isCustomApiKey ||
        process.env.DISABLE_PROMPT_CACHING ||
        process.env.API_TIMEOUT_MS ||
        process.env.MAX_THINKING_TOKENS ||
        process.env.ANTHROPIC_BASE_URL ||
        isCustomModel,
    )

  return (
    <Box flexDirection="column">
      <Box
        borderColor={theme.claude}
        borderStyle="round"
        flexDirection="column"
        gap={1}
        paddingLeft={1}
        width={width}
      >
        <Text>
          <Text color={theme.claude}>✻</Text> Welcome to{' '}
          <Text bold>{PRODUCT_NAME}</Text> <Text>research preview!</Text>
        </Text>
        <>
          <Box paddingLeft={2} flexDirection="column" gap={1}>
            <Text color={theme.secondaryText} italic>
              /help for help
              {process.env.USER_TYPE === 'ant' && <> · https://go/claude-cli</>}
            </Text>
            <Text color={theme.secondaryText}>cwd: {getCwd()}</Text>
          </Box>
          {hasOverrides && (
            <Box
              borderColor={theme.secondaryBorder}
              borderStyle="single"
              borderBottom={false}
              borderLeft={false}
              borderRight={false}
              borderTop={true}
              flexDirection="column"
              marginLeft={2}
              marginRight={1}
              paddingTop={1}
            >
              <Box marginBottom={1}>
                <Text color={theme.secondaryText}>Overrides (via env):</Text>
              </Box>
              {isCustomModel && (
                <Text color={theme.secondaryText}>
                  • Model: <Text bold>{currentModel}</Text>
                </Text>
              )}
              {isCustomApiKey && apiKey ? (
                <Text color={theme.secondaryText}>
                  • API Key:{' '}
                  <Text bold>sk-ant-…{apiKey!.slice(-width + 25)}</Text>
                </Text>
              ) : null}
              {process.env.DISABLE_PROMPT_CACHING ? (
                <Text color={theme.secondaryText}>
                  • Prompt caching:{' '}
                  <Text color={theme.error} bold>
                    off
                  </Text>
                </Text>
              ) : null}
              {process.env.API_TIMEOUT_MS ? (
                <Text color={theme.secondaryText}>
                  • API timeout:{' '}
                  <Text bold>{process.env.API_TIMEOUT_MS}ms</Text>
                </Text>
              ) : null}
              {process.env.MAX_THINKING_TOKENS ? (
                <Text color={theme.secondaryText}>
                  • Max thinking tokens:{' '}
                  <Text bold>{process.env.MAX_THINKING_TOKENS}</Text>
                </Text>
              ) : null}
              {process.env.ANTHROPIC_BASE_URL ? (
                <Text color={theme.secondaryText}>
                  • API Base URL:{' '}
                  <Text bold>{process.env.ANTHROPIC_BASE_URL}</Text>
                </Text>
              ) : null}
            </Box>
          )}
        </>
        {mcpClients.length ? (
          <Box
            borderColor={theme.secondaryBorder}
            borderStyle="single"
            borderBottom={false}
            borderLeft={false}
            borderRight={false}
            borderTop={true}
            flexDirection="column"
            marginLeft={2}
            marginRight={1}
            paddingTop={1}
          >
            <Box marginBottom={1}>
              <Text color={theme.secondaryText}>MCP Servers:</Text>
            </Box>
            {mcpClients.map((client, idx) => (
              <Box key={idx} width={width - 6}>
                <Text color={theme.secondaryText}>• {client.name}</Text>
                <Box flexGrow={1} />
                <Text
                  bold
                  color={
                    client.type === 'connected' ? theme.success : theme.error
                  }
                >
                  {client.type === 'connected' ? 'connected' : 'failed'}
                </Text>
              </Box>
            ))}
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}
