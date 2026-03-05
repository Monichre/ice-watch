import {Tabs} from 'expo-router'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {HapticTab} from '@/components/haptic-tab'
import {IconSymbol} from '@/components/ui/icon-symbol'
import {Platform} from 'react-native'

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const isWeb = Platform.OS === 'web'

  // On mobile web, give generous bottom padding for home indicator / browser chrome
  const bottomPadding = isWeb
    ? Math.max(insets.bottom, 16)
    : Math.max(insets.bottom, 8)

  const tabBarHeight = isWeb ? 76 + bottomPadding : 60 + bottomPadding
  const webTabBarStyle = {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(131,166,225,0.28)',
    boxShadow: '0 16px 36px rgba(2,8,20,0.45)',
    backdropFilter: 'blur(18px) saturate(130%)',
  } as const

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#56CCFF',
        tabBarInactiveTintColor: '#9CB0D3',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: isWeb ? 10 : 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: '#070d18',
          borderTopColor: 'rgba(131,166,225,0.2)',
          borderTopWidth: isWeb ? 0 : 1,
          ...(isWeb
            ? webTabBarStyle
            : {
                shadowColor: '#000',
                shadowOffset: {width: 0, height: -4},
                shadowOpacity: 0.5,
                shadowRadius: 12,
                elevation: 12,
              }),
        },
        tabBarLabelStyle: {
          fontSize: isWeb ? 12 : 10,
          fontWeight: '700',
          letterSpacing: 0.6,
          marginTop: isWeb ? 3 : 2,
          fontFamily: 'JetBrains Mono',
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name='index'
        options={{
          title: 'Map',
          tabBarIcon: ({color}) => (
            <IconSymbol size={28} name='map.fill' color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='sightings'
        options={{
          title: 'Reports',
          tabBarIcon: ({color}) => (
            <IconSymbol size={28} name='list.bullet' color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
