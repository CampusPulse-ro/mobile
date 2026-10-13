import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import { LANGUAGES, setLanguage, type Language } from '@/i18n'
import { color, radius, space } from '@/theme'

/** English / Română. The choice is saved on the device (see src/i18n). */
export function LanguageSwitch() {
  const { t, i18n } = useTranslation()

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('profile.language')}
      style={styles.row}
    >
      {LANGUAGES.map((language: Language) => {
        const selected = i18n.language === language
        return (
          <Pressable
            key={language}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => void setLanguage(language)}
            style={[styles.option, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {t(`language.${language}`)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  option: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.raised,
  },
  selected: { borderColor: color.accent },
  label: { color: color.inkSoft, fontSize: 15 },
  labelSelected: { color: color.ink, fontWeight: '600' },
})
