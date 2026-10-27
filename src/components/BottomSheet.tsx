import { useState, type ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { color, radius, space, type } from '@/theme'

/**
 * A bottom sheet over the screen, open while `item` is set; tapping outside or Back calls
 * `onClose`. `children` renders the item, and the last one stays on screen while the sheet slides
 * away. The class and deadline sheets both use it.
 */
export function BottomSheet<T>({
  item,
  onClose,
  children,
}: {
  item: T | null
  onClose: () => void
  children: (item: T) => ReactNode
}) {
  const insets = useSafeAreaInsets()
  const [shown, setShown] = useState(item)
  if (item && item !== shown) setShown(item)

  return (
    <Modal
      visible={item !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.scrim]}
          onPress={onClose}
          importantForAccessibility="no"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.handle} />
          {shown ? children(shown) : null}
        </View>
      </View>
    </Modal>
  )
}

/** One fact in a sheet: the value, with what it is underneath. */
export function SheetField({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.field} accessible>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  scrim: { backgroundColor: color.sunken, opacity: 0.75 },
  sheet: {
    maxHeight: '85%',
    backgroundColor: color.raised,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: color.line,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    marginTop: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.lineStrong,
  },
  field: { gap: 2 },
  value: { ...type.body, color: color.ink },
  label: { ...type.caption, color: color.inkMuted },
})
