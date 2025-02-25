import React from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from './TextInput.js'
import Link from 'ink-link'
// import figures from 'figures' (not used after refactoring)
import { validateField, ValidationError } from '../utils/validate.js'
import { openBrowser } from '../utils/browser.js'
import { getTheme } from '../utils/theme.js'
import { logEvent } from '../services/statsig.js'
import { logError } from '../utils/log.js'
import {
  AnimatedClaudeAsterisk,
  ClaudeAsteriskSize,
} from './AnimatedClaudeAsterisk.js'
import { useTerminalSize } from '../hooks/useTerminalSize.js'

export type FormData = {
  name: string
  email: string
  address1: string
  address2: string
  city: string
  state: string
  zip: string
  phone: string
  usLocation: boolean
}

interface StickerRequestFormProps {
  onSubmit: (data: FormData) => void
  onClose: () => void
  googleFormURL?: string
}

export function StickerRequestForm({
  onSubmit,
  onClose,
}: StickerRequestFormProps) {
  const [googleFormURL, setGoogleFormURL] = React.useState('')
  const { rows } = useTerminalSize()

  // Determine the appropriate asterisk size based on terminal height
  // Small ASCII art is 5 lines tall, large is 22 lines
  // Need to account for the form content too which needs about 18-22 lines minimum
  const getAsteriskSize = (): ClaudeAsteriskSize => {
    // Large terminals (can fit large ASCII art + form content comfortably)
    if (rows >= 50) {
      return 'large'
    }
    // Medium terminals (can fit medium ASCII art + form content)
    else if (rows >= 35) {
      return 'medium'
    }
    // Small terminals or any other case
    else {
      return 'small'
    }
  }

  // Animation logic is now handled by the AnimatedClaudeAsterisk component

  // Function to generate Google Form URL
  const generateGoogleFormURL = (data: FormData) => {
    // URL encode all form values
    const name = encodeURIComponent(data.name || '')
    const email = encodeURIComponent(data.email || '')
    const phone = encodeURIComponent(data.phone || '')
    const address1 = encodeURIComponent(data.address1 || '')
    const address2 = encodeURIComponent(data.address2 || '')
    const city = encodeURIComponent(data.city || '')
    const state = encodeURIComponent(data.state || '')
    // Set country as United States since we're only shipping there
    const country = encodeURIComponent('USA')

    return `https://docs.google.com/forms/d/e/1FAIpQLSfYhWr1a-t4IsvS2FKyEH45HRmHKiPUycvAlFKaD0NugqvfDA/viewform?usp=pp_url&entry.2124017765=${name}&entry.1522143766=${email}&entry.1730584532=${phone}&entry.1700407131=${address1}&entry.109484232=${address2}&entry.1209468849=${city}&entry.222866183=${state}&entry.1042966503=${country}`
  }

  const [formState, setFormState] = React.useState<Partial<FormData>>({})
  const [currentField, setCurrentField] = React.useState<keyof FormData>('name')
  const [inputValue, setInputValue] = React.useState('')
  const [cursorOffset, setCursorOffset] = React.useState(0)
  const [error, setError] = React.useState<ValidationError | null>(null)
  const [showingSummary, setShowingSummary] = React.useState(false)
  const [showingNonUsMessage, setShowingNonUsMessage] = React.useState(false)

  const [selectedYesNo, setSelectedYesNo] = React.useState<'yes' | 'no'>('yes')
  const theme = getTheme()

  const fields: Array<{ key: keyof FormData; label: string }> = [
    { key: 'name', label: 'Name' },
    { key: 'usLocation', label: 'Are you in the United States? (y/n)' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone Number' },
    { key: 'address1', label: 'Address Line 1' },
    { key: 'address2', label: 'Address Line 2 (optional)' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'zip', label: 'ZIP Code' },
  ]

  // Helper to navigate to the next field
  const goToNextField = (currentKey: keyof FormData) => {
    // Log form progression
    const currentIndex = fields.findIndex(f => f.key === currentKey)
    const nextIndex = currentIndex + 1

    if (currentIndex === -1) throw new Error('Invalid field state')
    const nextField = fields[nextIndex]
    if (!nextField) throw new Error('Invalid field state')

    // Log field completion event
    logEvent('sticker_form_field_completed', {
      field_name: currentKey,
      field_index: currentIndex.toString(),
      next_field: nextField.key,
      form_progress: `${nextIndex}/${fields.length}`,
    })

    setCurrentField(nextField.key)
    const newValue = formState[nextField.key]?.toString() || ''
    setInputValue(newValue)
    setCursorOffset(newValue.length)
    setError(null)
  }

  useInput((input, key) => {
    // Exit on Escape, Ctrl-C, or Ctrl-D
    if (key.escape || (key.ctrl && (input === 'c' || input === 'd'))) {
      onClose()
      return
    }

    // Handle return key on non-US message screen
    if (showingNonUsMessage && key.return) {
      onClose()
      return
    }

    // Handle Y/N keypresses and arrow navigation for US location question
    if (currentField === 'usLocation' && !showingSummary) {
      // Arrow key navigation for Yes/No
      if (key.leftArrow || key.rightArrow) {
        setSelectedYesNo(prev => (prev === 'yes' ? 'no' : 'yes'))
        return
      }

      if (key.return) {
        if (selectedYesNo === 'yes') {
          const newState = { ...formState, [currentField]: true }
          setFormState(newState)

          // Move to next field
          goToNextField(currentField)
        } else {
          setShowingNonUsMessage(true)
        }
        return
      }

      // Handle direct Y/N keypresses
      const normalized = input.toLowerCase()
      if (['y', 'yes'].includes(normalized)) {
        const newState = { ...formState, [currentField]: true }
        setFormState(newState)

        // Move to next field
        goToNextField(currentField)
        return
      }
      if (['n', 'no'].includes(normalized)) {
        setShowingNonUsMessage(true)
        return
      }
    }

    // Allows tabbing between form fields with validation
    if (!showingSummary) {
      if (key.tab) {
        if (key.shift) {
          const currentIndex = fields.findIndex(f => f.key === currentField)
          if (currentIndex === -1) throw new Error('Invalid field state')
          const prevIndex = (currentIndex - 1 + fields.length) % fields.length
          const prevField = fields[prevIndex]
          if (!prevField) throw new Error('Invalid field index')
          setCurrentField(prevField.key)
          const newValue = formState[prevField.key]?.toString() || ''
          setInputValue(newValue)
          setCursorOffset(newValue.length)
          setError(null)
          return
        }

        if (currentField !== 'address2' && currentField !== 'usLocation') {
          const currentValue = inputValue.trim()
          const validationError = validateField(currentField, currentValue)
          if (validationError) {
            setError({
              message: 'Please fill out this field before continuing',
            })
            return
          }
          const newState = { ...formState, [currentField]: currentValue }
          setFormState(newState)
        }

        // Find the next field index with modulo wrap-around
        const currentIndex = fields.findIndex(f => f.key === currentField)
        if (currentIndex === -1) throw new Error('Invalid field state')
        const nextIndex = (currentIndex + 1) % fields.length
        const nextField = fields[nextIndex]
        if (!nextField) throw new Error('Invalid field index')

        // Use our helper to navigate to this field
        setCurrentField(nextField.key)
        const newValue = formState[nextField.key]?.toString() || ''
        setInputValue(newValue)
        setCursorOffset(newValue.length)
        setError(null)
        return
      }
    }

    if (showingSummary) {
      if (key.return) {
        onSubmit(formState as FormData)
      }
    }
  })

  const handleSubmit = (value: string) => {
    if (!value && currentField === 'address2') {
      const newState = { ...formState, [currentField]: '' }
      setFormState(newState)
      goToNextField(currentField)
      return
    }

    const validationError = validateField(currentField, value)
    if (validationError) {
      setError(validationError)
      return
    }

    if (currentField === 'state' && formState.zip) {
      const zipError = validateField('zip', formState.zip)
      if (zipError) {
        setError({
          message: 'The existing ZIP code is not valid for this state',
        })
        return
      }
    }

    const newState = { ...formState, [currentField]: value }
    setFormState(newState)
    setError(null)

    const currentIndex = fields.findIndex(f => f.key === currentField)
    if (currentIndex === -1) throw new Error('Invalid field state')

    if (currentIndex < fields.length - 1) {
      goToNextField(currentField)
    } else {
      setShowingSummary(true)
    }
  }

  const currentFieldDef = fields.find(f => f.key === currentField)
  if (!currentFieldDef) throw new Error('Invalid field state')

  // Generate Google Form URL for summary view and open it automatically
  if (showingSummary && !googleFormURL) {
    const url = generateGoogleFormURL(formState as FormData)
    setGoogleFormURL(url)

    // Log reaching the summary page
    logEvent('sticker_form_summary_reached', {
      fields_completed: Object.keys(formState).length.toString(),
    })

    // Auto-open the URL in the user's browser
    openBrowser(url).catch(err => {
      logError(err)
    })
  }

  const classifiedHeaderText = `╔══════════════════════════════╗
║         CLASSIFIED           ║
╚══════════════════════════════╝`
  const headerText = `You've discovered Claude's top secret sticker distribution operation!`

  // Helper function to render the header section
  const renderHeader = () => (
    <>
      <Box flexDirection="column" alignItems="center" justifyContent="center">
        <Text>{classifiedHeaderText}</Text>
        <Text bold color={theme.claude}>
          {headerText}
        </Text>
      </Box>
      {!showingSummary && (
        <Box justifyContent="center">
          <AnimatedClaudeAsterisk
            size={getAsteriskSize()}
            cycles={getAsteriskSize() === 'large' ? 4 : undefined}
          />
        </Box>
      )}
    </>
  )

  // Helper function to render the footer section
  const renderFooter = () => (
    <Box marginLeft={1}>
      {showingNonUsMessage || showingSummary ? (
        <Text color={theme.suggestion} bold>
          Press Enter to return to base
        </Text>
      ) : (
        <Text color={theme.secondaryText}>
          {currentField === 'usLocation' ? (
            <>
              ←/→ arrows to select · Enter to confirm · Y/N keys also work · Esc
              Esc to abort mission
            </>
          ) : (
            <>
              Enter to continue · Tab/Shift+Tab to navigate · Esc to abort
              mission
            </>
          )}
        </Text>
      )}
    </Box>
  )

  // Helper function to render the main content based on current state
  const renderContent = () => {
    if (showingSummary) {
      return (
        <>
          <Box>
            <Text color={theme.suggestion} bold>
              Please review your shipping information:
            </Text>
          </Box>

          <Box flexDirection="column">
            {fields
              .filter(f => f.key !== 'usLocation')
              .map(field => (
                <Box key={field.key} marginLeft={3}>
                  <Text>
                    <Text bold color={theme.text}>
                      {field.label}:
                    </Text>{' '}
                    <Text
                      color={
                        !formState[field.key] ? theme.secondaryText : theme.text
                      }
                    >
                      {formState[field.key] || '(empty)'}
                    </Text>
                  </Text>
                </Box>
              ))}
          </Box>

          {/* Google Form URL with improved instructions */}
          <Box marginTop={1} marginBottom={1} flexDirection="column">
            <Box>
              <Text color={theme.text}>Submit your sticker request:</Text>
            </Box>
            <Box marginTop={1}>
              <Link url={googleFormURL}>
                <Text color={theme.success} underline>
                  ➜ Click here to open Google Form
                </Text>
              </Link>
            </Box>
            <Box marginTop={1}>
              <Text color={theme.secondaryText} italic>
                (You can still edit your info on the form)
              </Text>
            </Box>
          </Box>
        </>
      )
    } else if (showingNonUsMessage) {
      return (
        <>
          <Box marginY={1}>
            <Text color={theme.error} bold>
              Mission Not Available
            </Text>
          </Box>

          <Box flexDirection="column" marginY={1}>
            <Text color={theme.text}>
              We&apos;re sorry, but the Claude sticker deployment mission is
              only available within the United States.
            </Text>
            <Box marginTop={1}>
              <Text color={theme.text}>
                Future missions may expand to other territories. Stay tuned for
                updates.
              </Text>
            </Box>
          </Box>
        </>
      )
    } else {
      return (
        <>
          <Box flexDirection="column">
            <Text color={theme.text}>
              Please provide your coordinates for the sticker deployment
              mission.
            </Text>
            <Text color={theme.secondaryText}>
              Currently only shipping within the United States.
            </Text>
          </Box>

          <Box flexDirection="column">
            <Box flexDirection="row" marginLeft={2}>
              {fields.map((f, i) => (
                <React.Fragment key={f.key}>
                  <Text
                    color={
                      f.key === currentField
                        ? theme.suggestion
                        : theme.secondaryText
                    }
                  >
                    {f.key === currentField ? (
                      `[${f.label}]`
                    ) : formState[f.key] ? (
                      <Text color={theme.secondaryText}>●</Text>
                    ) : (
                      '○'
                    )}
                  </Text>
                  {i < fields.length - 1 && <Text> </Text>}
                </React.Fragment>
              ))}
            </Box>
            <Box marginLeft={2}>
              <Text color={theme.secondaryText}>
                Field {fields.findIndex(f => f.key === currentField) + 1} of{' '}
                {fields.length}
              </Text>
            </Box>
          </Box>

          <Box flexDirection="column" marginX={2}>
            {currentField === 'usLocation' ? (
              // Special Yes/No Buttons for US Location
              <Box flexDirection="row">
                <Text
                  color={
                    selectedYesNo === 'yes'
                      ? theme.success
                      : theme.secondaryText
                  }
                  bold
                >
                  {selectedYesNo === 'yes' ? '●' : '○'} YES
                </Text>
                <Text> </Text>
                <Text
                  color={
                    selectedYesNo === 'no' ? theme.error : theme.secondaryText
                  }
                  bold
                >
                  {selectedYesNo === 'no' ? '●' : '○'} NO
                </Text>
              </Box>
            ) : (
              // Regular TextInput for other fields
              <TextInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSubmit}
                placeholder={currentFieldDef.label}
                cursorOffset={cursorOffset}
                onChangeCursorOffset={setCursorOffset}
                columns={40}
              />
            )}
            {error && (
              <Box marginTop={1}>
                <Text color={theme.error} bold>
                  ✗ {error.message}
                </Text>
              </Box>
            )}
          </Box>
        </>
      )
    }
  }

  // Main render with consistent structure
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box
        borderColor={theme.claude}
        borderStyle="round"
        flexDirection="column"
        gap={1}
        padding={1}
        paddingLeft={2}
        width={100}
      >
        {renderHeader()}
        {renderContent()}
      </Box>
      {renderFooter()}
    </Box>
  )
}
