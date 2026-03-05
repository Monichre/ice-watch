import {Platform, View, type ViewProps} from 'react-native'
import {SafeAreaView, type Edge} from 'react-native-safe-area-context'

import {cn} from '@/lib/utils'

export interface ScreenContainerProps extends ViewProps {
  /**
   * SafeArea edges to apply. Defaults to ["top", "left", "right"].
   * Bottom is typically handled by Tab Bar.
   */
  edges?: Edge[]
  /**
   * Tailwind className for the content area.
   */
  className?: string
  /**
   * Additional className for the outer container (background layer).
   */
  containerClassName?: string
  /**
   * Additional className for the SafeAreaView (content layer).
   */
  safeAreaClassName?: string
  /**
   * Constrain content width on web.
   */
  webMaxWidth?: number
  /**
   * Disable width constraints even when webMaxWidth is set.
   */
  disableWebMaxWidth?: boolean
}

/**
 * A container component that properly handles SafeArea and background colors.
 *
 * The outer View extends to full screen (including status bar area) with the background color,
 * while the inner SafeAreaView ensures content is within safe bounds.
 *
 * Usage:
 * ```tsx
 * <ScreenContainer className="p-4">
 *   <Text className="text-2xl font-bold text-foreground">
 *     Welcome
 *   </Text>
 * </ScreenContainer>
 * ```
 */
export function ScreenContainer({
  children,
  edges = ['top', 'left', 'right'],
  className,
  containerClassName,
  safeAreaClassName,
  webMaxWidth = 1320,
  disableWebMaxWidth = false,
  style,
  ...props
}: ScreenContainerProps) {
  const constrainedStyle =
    Platform.OS === 'web' && !disableWebMaxWidth
      ? ({width: '100%', maxWidth: webMaxWidth, alignSelf: 'center'} as const)
      : null

  return (
    <View
      className={cn('flex-1', 'bg-background', containerClassName)}
      {...props}
    >
      <SafeAreaView
        edges={edges}
        className={cn('flex-1', safeAreaClassName)}
        style={style}
      >
        <View
          className={cn('flex-1', className)}
          style={constrainedStyle as any}
        >
          {children}
        </View>
      </SafeAreaView>
    </View>
  )
}
