import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  AccessibilityInfo,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../../components/GradientBackground";
import { setOnboardingSeen } from "../../services/auth";
import { useTheme } from "../../theme/ThemeProvider";

type FeatherIcon = ComponentProps<typeof Feather>["name"];
type VisualMode = "feed" | "map" | "social" | "qr";

interface SlideChip {
  icon: FeatherIcon;
  text: string;
}

interface OnboardingSlide {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  accent: string;
  accentSoft: string;
  icon: FeatherIcon;
  chips: SlideChip[];
  visual: VisualMode;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: "feed",
    label: "Scopri",
    title: "I locali giusti.\nSubito.",
    subtitle: "Feed rapido con venue ed eventi da non perdere.",
    accent: "#FF7A59",
    accentSoft: "#FFC3A8",
    icon: "radio",
    chips: [
      { icon: "trending-up", text: "Trend" },
      { icon: "calendar", text: "Eventi" },
    ],
    visual: "feed",
  },
  {
    id: "map",
    label: "Mappa",
    title: "Guarda dove\nsi accende la notte.",
    subtitle: "Apri la mappa e trova al volo cosa succede vicino a te.",
    accent: "#31D7B6",
    accentSoft: "#9EF2E1",
    icon: "map-pin",
    chips: [
      { icon: "activity", text: "Zone calde" },
      { icon: "navigation", text: "Vicino a te" },
    ],
    visual: "map",
  },
  {
    id: "social",
    label: "Gruppo",
    title: "Decidete insieme.\nSenza confusione.",
    subtitle: "Invita amici, vota una meta e gestisci il tavolo in un posto solo.",
    accent: "#63A7FF",
    accentSoft: "#B9D5FF",
    icon: "users",
    chips: [
      { icon: "send", text: "Invita" },
      { icon: "check-circle", text: "Vota" },
      { icon: "coffee", text: "Tavolo" },
    ],
    visual: "social",
  },
  {
    id: "qr",
    label: "Prenota",
    title: "Prenota e entra\nin pochi secondi.",
    subtitle: "Conferma veloce e QR pronto all'ingresso.",
    accent: "#F5B942",
    accentSoft: "#FFE2A2",
    icon: "check-square",
    chips: [
      { icon: "credit-card", text: "Booking" },
      { icon: "maximize", text: "QR" },
    ],
    visual: "qr",
  },
];

const BACKDROP_COLORS = SLIDES.map((slide) => slide.accent);
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<OnboardingSlide>);

function AmbientOrb({
  index,
  scrollX,
  width,
  size,
  color,
  style,
}: {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}) {
  const inputRange = SLIDES.map((_, slideIndex) => slideIndex * width);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, inputRange, [0.18, 0.3, 0.2, 0.15], Extrapolation.CLAMP),
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          inputRange,
          index === 0 ? [-20, 22, -12, 10] : index === 1 ? [28, -18, 22, -12] : [-10, 10, -18, 22],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          scrollX.value,
          inputRange,
          index === 0 ? [12, -18, 10, -6] : index === 1 ? [-16, 8, -12, 14] : [10, -10, 14, -8],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(scrollX.value, inputRange, [0.92, 1.06, 0.96, 1.02], Extrapolation.CLAMP),
      },
    ],
  }));

  return <Animated.View style={[styles.ambientOrb, { width: size, height: size, backgroundColor: color }, style, animatedStyle]} />;
}

function PaginationDot({
  index,
  scrollX,
  width,
  activeColor,
  inactiveColor,
}: {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
  activeColor: string;
  inactiveColor: string;
}) {
  const inputRange = SLIDES.map((_, slideIndex) => slideIndex * width);
  const animatedStyle = useAnimatedStyle(() => ({
    width: interpolate(
      scrollX.value,
      inputRange,
      SLIDES.map((_, slideIndex) => (slideIndex === index ? 30 : 8)),
      Extrapolation.CLAMP,
    ),
    backgroundColor: interpolateColor(
      scrollX.value,
      inputRange,
      SLIDES.map((_, slideIndex) => (slideIndex === index ? activeColor : inactiveColor)),
    ),
    opacity: interpolate(
      scrollX.value,
      inputRange,
      SLIDES.map((_, slideIndex) => (slideIndex === index ? 1 : 0.55)),
      Extrapolation.CLAMP,
    ),
  }));

  return <Animated.View style={[styles.paginationDot, animatedStyle]} />;
}

function FeedVisual({ slide, pulseProgress }: { slide: OnboardingSlide; pulseProgress: SharedValue<number> }) {
  const stackStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(pulseProgress.value, [0, 1], [-1.6, 1.6])}deg` }],
  }));

  return (
    <View style={styles.visualContent}>
      <Animated.View style={[styles.feedCardBack, stackStyle]} />
      <View style={styles.feedCardMain}>
        <View style={styles.feedHighlightRow}>
          <View style={[styles.feedAccentBlock, { backgroundColor: slide.accent }]} />
          <View style={styles.feedTextLines}>
            <View style={styles.feedLineStrong} />
            <View style={styles.feedLineSoft} />
          </View>
          <View style={styles.feedScorePill}>
            <Text style={styles.feedScoreText}>9.4</Text>
          </View>
        </View>

        <View style={styles.feedEventRow}>
          <View style={[styles.feedMiniCard, { borderColor: slide.accent + "24" }]}>
            <Text style={styles.feedMiniTitle}>Club pick</Text>
            <Text style={styles.feedMiniSubtitle}>Rooftop set</Text>
          </View>
          <View style={styles.feedMiniColumn}>
            <View style={styles.feedMiniBar} />
            <View style={[styles.feedMiniBar, styles.feedMiniBarShort]} />
            <View style={[styles.feedMiniBar, styles.feedMiniBarAccent, { backgroundColor: slide.accent + "99" }]} />
          </View>
        </View>

        <View style={styles.feedFooterRow}>
          <View style={styles.feedFooterBadge}>
            <Feather name="music" size={14} color={slide.accent} />
            <Text style={styles.feedFooterText}>Nuovi set</Text>
          </View>
          <View style={styles.feedFooterBadge}>
            <Feather name="clock" size={14} color="#F6D885" />
            <Text style={styles.feedFooterText}>Aggiornato ora</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function MapVisual({ slide, pulseProgress }: { slide: OnboardingSlide; pulseProgress: SharedValue<number> }) {
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseProgress.value, [0, 1], [0.24, 0.48]),
    transform: [{ scale: interpolate(pulseProgress.value, [0, 1], [0.78, 1.08]) }],
  }));

  return (
    <View style={styles.visualContent}>
      <View style={styles.mapGrid}>
        <View style={styles.mapGridLineHorizontal} />
        <View style={[styles.mapGridLineHorizontal, styles.mapGridLineMiddle]} />
        <View style={styles.mapGridLineVertical} />
        <View style={[styles.mapGridLineVertical, styles.mapGridLineRight]} />

        <Animated.View style={[styles.mapPulse, { borderColor: slide.accent }, pulseStyle]} />
        <View style={[styles.mapPinPrimary, { backgroundColor: slide.accent }]}>
          <Feather name="map-pin" size={18} color="#05070B" />
        </View>
        <View style={styles.mapPinSecondary}>
          <Feather name="music" size={16} color="#FFFFFF" />
        </View>
        <View style={styles.mapRoute} />

        <View style={styles.mapStatsCard}>
          <Text style={styles.mapStatsValue}>4 min</Text>
          <Text style={styles.mapStatsLabel}>dal locale piu caldo</Text>
        </View>
      </View>
    </View>
  );
}

function SocialVisual({ slide, pulseProgress }: { slide: OnboardingSlide; pulseProgress: SharedValue<number> }) {
  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(pulseProgress.value, [0, 1], [0, -4]) }],
  }));

  return (
    <View style={styles.visualContent}>
      <View style={styles.socialPanel}>
        <View style={styles.socialHeader}>
          <Text style={styles.socialTitle}>Crew Friday</Text>
          <View style={[styles.socialStatusPill, { backgroundColor: slide.accent + "16", borderColor: slide.accent + "36" }]}>
            <Text style={[styles.socialStatusText, { color: slide.accentSoft }]}>3 voti live</Text>
          </View>
        </View>

        <View style={styles.socialAvatarsRow}>
          {["A", "L", "N"].map((letter, avatarIndex) => (
            <Animated.View
              key={letter}
              style={[
                styles.socialAvatar,
                {
                  marginLeft: avatarIndex === 0 ? 0 : -12,
                  backgroundColor: avatarIndex === 1 ? slide.accent + "CC" : avatarIndex === 2 ? "#F6D885" : "#89A8FF",
                },
                avatarStyle,
              ]}
            >
              <Text style={styles.socialAvatarText}>{letter}</Text>
            </Animated.View>
          ))}
        </View>

        <View style={styles.voteCard}>
          <View style={styles.voteRow}>
            <Text style={styles.voteLabel}>Table Garden</Text>
            <Text style={styles.voteCount}>68%</Text>
          </View>
          <View style={styles.voteTrack}>
            <View style={[styles.voteFill, { width: "68%", backgroundColor: slide.accent }]} />
          </View>
        </View>

        <View style={styles.voteCard}>
          <View style={styles.voteRow}>
            <Text style={styles.voteLabel}>Open air</Text>
            <Text style={styles.voteCount}>32%</Text>
          </View>
          <View style={styles.voteTrack}>
            <View style={[styles.voteFill, { width: "32%", backgroundColor: "#F6D885" }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

function QrVisual({ slide, pulseProgress }: { slide: OnboardingSlide; pulseProgress: SharedValue<number> }) {
  const qrStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulseProgress.value, [0, 1], [0.98, 1.02]) }],
  }));

  return (
    <View style={styles.visualContent}>
      <View style={styles.qrTicket}>
        <View style={styles.qrTicketTop}>
          <View>
            <Text style={styles.qrLabel}>Express pass</Text>
            <Text style={styles.qrVenue}>NightHub entry</Text>
          </View>
          <View style={[styles.qrConfirmPill, { backgroundColor: slide.accent + "16", borderColor: slide.accent + "32" }]}>
            <Feather name="check" size={14} color={slide.accent} />
            <Text style={[styles.qrConfirmText, { color: slide.accentSoft }]}>Confermato</Text>
          </View>
        </View>

        <Animated.View style={[styles.qrCodeShell, qrStyle]}>
          {Array.from({ length: 4 }).map((_, row) => (
            <View key={`row-${row}`} style={styles.qrCodeRow}>
              {Array.from({ length: 4 }).map((__, column) => (
                <View
                  key={`cell-${row}-${column}`}
                  style={[
                    styles.qrCell,
                    (row + column) % 2 === 0 ? styles.qrCellDark : styles.qrCellLight,
                    row === 0 && column === 0 ? { backgroundColor: slide.accent } : null,
                    row === 2 && column === 1 ? { backgroundColor: slide.accent } : null,
                  ]}
                />
              ))}
            </View>
          ))}
        </Animated.View>

        <View style={styles.qrFooterRow}>
          <Text style={styles.qrFooterText}>Scansione istantanea</Text>
          <Feather name="arrow-right" size={16} color="#F8F7FF" />
        </View>
      </View>
    </View>
  );
}

function HeroVisual({
  slide,
  index,
  width,
  scrollX,
  introProgress,
  pulseProgress,
  isCompact,
}: {
  slide: OnboardingSlide;
  index: number;
  width: number;
  scrollX: SharedValue<number>;
  introProgress: SharedValue<number>;
  pulseProgress: SharedValue<number>;
  isCompact: boolean;
}) {
  const heroSize = Math.min(width * 0.78, isCompact ? 290 : 338);
  const orbitStyle = useAnimatedStyle(() => {
    const pageOffset = (scrollX.value - index * width) / width;
    const pulseScale = interpolate(pulseProgress.value, [0, 1], [1, 1.035]);
    const introLift = interpolate(introProgress.value, [0, 1], [24, 0], Extrapolation.CLAMP);

    return {
      opacity: interpolate(Math.abs(pageOffset), [0, 1], [1, 0.24], Extrapolation.CLAMP) * introProgress.value,
      transform: [
        { translateX: interpolate(pageOffset, [-1, 0, 1], [20, 0, -20], Extrapolation.CLAMP) },
        { translateY: interpolate(Math.abs(pageOffset), [0, 1], [0, 18], Extrapolation.CLAMP) + introLift },
        { scale: interpolate(Math.abs(pageOffset), [0, 1], [pulseScale, 0.92], Extrapolation.CLAMP) },
      ],
    };
  });

  const accentBadgeStyle = useAnimatedStyle(() => {
    const pageOffset = (scrollX.value - index * width) / width;

    return {
      opacity: interpolate(Math.abs(pageOffset), [0, 1], [1, 0.18], Extrapolation.CLAMP) * introProgress.value,
      transform: [
        { translateX: interpolate(pageOffset, [-1, 0, 1], [36, 0, -36], Extrapolation.CLAMP) },
        { translateY: interpolate(pageOffset, [-1, 0, 1], [-10, 0, 10], Extrapolation.CLAMP) },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseProgress.value, [0, 1], [0.28, 0.42]),
    transform: [{ scale: interpolate(pulseProgress.value, [0, 1], [0.96, 1.08]) }],
  }));

  return (
    <Animated.View style={[styles.heroShell, { height: heroSize }, orbitStyle]}>
      <Animated.View
        style={[
          styles.heroGlow,
          {
            width: heroSize * 0.82,
            height: heroSize * 0.82,
            backgroundColor: slide.accent,
          },
          glowStyle,
        ]}
      />

      <LinearGradient
        colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0.05)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroFrame, { width: heroSize, height: heroSize * 0.92 }]}
      >
        {slide.visual === "feed" ? <FeedVisual slide={slide} pulseProgress={pulseProgress} /> : null}
        {slide.visual === "map" ? <MapVisual slide={slide} pulseProgress={pulseProgress} /> : null}
        {slide.visual === "social" ? <SocialVisual slide={slide} pulseProgress={pulseProgress} /> : null}
        {slide.visual === "qr" ? <QrVisual slide={slide} pulseProgress={pulseProgress} /> : null}
      </LinearGradient>

      <Animated.View
        style={[
          styles.heroBadge,
          styles.heroBadgeTop,
          { borderColor: slide.accent + "40", backgroundColor: "rgba(8,10,16,0.8)" },
          accentBadgeStyle,
        ]}
      >
        <Feather name={slide.icon} size={14} color={slide.accent} />
        <Text style={styles.heroBadgeText}>{slide.label}</Text>
      </Animated.View>
    </Animated.View>
  );
}

function SlideContent({
  item,
  index,
  width,
  scrollX,
  introProgress,
  pulseProgress,
  isCompact,
  textColor,
}: {
  item: OnboardingSlide;
  index: number;
  width: number;
  scrollX: SharedValue<number>;
  introProgress: SharedValue<number>;
  pulseProgress: SharedValue<number>;
  isCompact: boolean;
  textColor: string;
}) {
  const titleStyle = useAnimatedStyle(() => {
    const pageOffset = (scrollX.value - index * width) / width;
    const introOffset = interpolate(introProgress.value, [0, 1], [18, 0], Extrapolation.CLAMP);

    return {
      opacity: interpolate(Math.abs(pageOffset), [0, 1], [1, 0.12], Extrapolation.CLAMP) * introProgress.value,
      transform: [
        { translateX: interpolate(pageOffset, [-1, 0, 1], [30, 0, -30], Extrapolation.CLAMP) },
        { translateY: interpolate(Math.abs(pageOffset), [0, 1], [0, 18], Extrapolation.CLAMP) + introOffset },
      ],
    };
  });

  const subtitleStyle = useAnimatedStyle(() => {
    const pageOffset = (scrollX.value - index * width) / width;
    const introOffset = interpolate(introProgress.value, [0, 1], [28, 0], Extrapolation.CLAMP);

    return {
      opacity: interpolate(Math.abs(pageOffset), [0, 1], [1, 0.08], Extrapolation.CLAMP) * introProgress.value,
      transform: [
        { translateX: interpolate(pageOffset, [-1, 0, 1], [22, 0, -22], Extrapolation.CLAMP) },
        { translateY: interpolate(Math.abs(pageOffset), [0, 1], [0, 24], Extrapolation.CLAMP) + introOffset },
      ],
    };
  });

  const chipsStyle = useAnimatedStyle(() => {
    const pageOffset = (scrollX.value - index * width) / width;
    const introOffset = interpolate(introProgress.value, [0, 1], [38, 0], Extrapolation.CLAMP);

    return {
      opacity: interpolate(Math.abs(pageOffset), [0, 1], [1, 0.08], Extrapolation.CLAMP) * introProgress.value,
      transform: [
        { translateY: interpolate(Math.abs(pageOffset), [0, 1], [0, 28], Extrapolation.CLAMP) + introOffset },
      ],
    };
  });

  return (
    <View style={[styles.slide, { width, paddingTop: isCompact ? 8 : 18 }]}>
      <HeroVisual
        slide={item}
        index={index}
        width={width}
        scrollX={scrollX}
        introProgress={introProgress}
        pulseProgress={pulseProgress}
        isCompact={isCompact}
      />

      <Animated.View style={[styles.copyBlock, titleStyle]}>
        <View style={[styles.labelPill, { backgroundColor: item.accent + "12", borderColor: item.accent + "2E" }]}>
          <Text style={[styles.labelText, { color: item.accentSoft }]}>{item.label}</Text>
        </View>

        <Text style={[styles.title, { color: textColor }]}>{item.title}</Text>
      </Animated.View>

      <Animated.Text style={[styles.subtitle, { color: "rgba(244, 242, 255, 0.76)" }, subtitleStyle]}>
        {item.subtitle}
      </Animated.Text>

      <Animated.View style={[styles.chipsRow, chipsStyle]}>
        {item.chips.map((chip) => (
          <View
            key={chip.text}
            style={[
              styles.chip,
              {
                borderColor: "rgba(255,255,255,0.08)",
                backgroundColor: "rgba(255,255,255,0.05)",
              },
            ]}
          >
            <Feather name={chip.icon} size={16} color={item.accent} />
            <Text style={[styles.chipText, { color: textColor }]}>{chip.text}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

export default function OnboardingScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { theme } = useTheme();
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const scrollX = useSharedValue(0);
  const introProgress = useSharedValue(0);
  const pulseProgress = useSharedValue(0);
  const canReturn = typeof navigation?.canGoBack === "function" && navigation.canGoBack();
  const currentSlide = SLIDES[currentIndex];
  const isCompact = height < 760;

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        if (mounted) setReduceMotion(false);
      });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      setReduceMotion(enabled);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    introProgress.value = 0;
    introProgress.value = withTiming(1, {
      duration: reduceMotion ? 1 : 720,
      easing: Easing.out(Easing.cubic),
    });
  }, [introProgress, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      pulseProgress.value = 0.5;
      return;
    }

    pulseProgress.value = withRepeat(
      withTiming(1, {
        duration: 2200,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
  }, [pulseProgress, reduceMotion]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const triggerImpact = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // ignore haptic availability issues
    }
  };

  const completeOnboarding = async () => {
    try {
      if (!canReturn) {
        await setOnboardingSeen(true);
      }
    } catch {
      // ignore storage errors
    }

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // ignore haptic availability issues
    }

    if (canReturn) {
      navigation.goBack();
      return;
    }

    navigation.replace("Register", { firstLaunch: true });
  };

  const goNext = async () => {
    await triggerImpact();

    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
      return;
    }

    await completeOnboarding();
  };

  const goPrev = async () => {
    if (currentIndex === 0) return;

    const previousIndex = currentIndex - 1;
    flatListRef.current?.scrollToIndex({ index: previousIndex, animated: true });
    setCurrentIndex(previousIndex);
    await triggerImpact();
  };

  const ctaStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      scrollX.value,
      SLIDES.map((_, index) => index * width),
      BACKDROP_COLORS,
    ),
    transform: [
      {
        scale: interpolate(
          scrollX.value,
          SLIDES.map((_, index) => index * width),
          [1, 0.985, 1, 1.015],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const ctaArrowStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          SLIDES.map((_, index) => index * width),
          [0, 0, 2, 6],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <GradientBackground>
      <StatusBar barStyle="light-content" />

      <View style={styles.root}>
        <View pointerEvents="none" style={styles.backdropLayer}>
          <AmbientOrb index={0} scrollX={scrollX} width={width} size={280} color="rgba(255,122,89,0.28)" style={styles.backdropOrbTop} />
          <AmbientOrb index={1} scrollX={scrollX} width={width} size={320} color="rgba(49,215,182,0.22)" style={styles.backdropOrbRight} />
          <AmbientOrb index={2} scrollX={scrollX} width={width} size={300} color="rgba(99,167,255,0.20)" style={styles.backdropOrbBottom} />
          <LinearGradient
            colors={["rgba(12,12,18,0.08)", "rgba(5,7,11,0.86)"]}
            start={{ x: 0.4, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.textureGrid} />
        </View>

        <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.header}>
            <View style={styles.brandWrap}>
              <View style={styles.brandDot} />
              <Text style={styles.brandText}>NightHub</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={canReturn ? "Chiudi onboarding" : "Salta onboarding"}
              hitSlop={12}
              onPress={completeOnboarding}
              style={styles.skipButton}
            >
              <Text style={styles.skipText}>{canReturn ? "Chiudi" : "Salta"}</Text>
            </Pressable>
          </View>

          <AnimatedFlatList
            ref={flatListRef}
            data={SLIDES}
            renderItem={({ item, index }) => (
              <SlideContent
                item={item}
                index={index}
                width={width}
                scrollX={scrollX}
                introProgress={introProgress}
                pulseProgress={pulseProgress}
                isCompact={isCompact}
                textColor={theme.colors.text}
              />
            )}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
              setCurrentIndex(nextIndex);
            }}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            style={styles.list}
            contentContainerStyle={styles.listContent}
          />

          <View style={styles.footer}>
            <View style={styles.paginationRow}>
              {SLIDES.map((slide, index) => (
                <PaginationDot
                  key={slide.id}
                  index={index}
                  scrollX={scrollX}
                  width={width}
                  activeColor={currentSlide.accent}
                  inactiveColor="rgba(255,255,255,0.18)"
                />
              ))}
            </View>

            <View style={styles.footerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Indietro"
                disabled={currentIndex === 0}
                hitSlop={8}
                onPress={goPrev}
                style={[styles.backButton, currentIndex === 0 ? styles.backButtonHidden : null]}
              >
                <Feather name="arrow-left" size={20} color="#F8F7FF" />
              </Pressable>

              <Animated.View style={[styles.ctaShell, ctaStyle]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={currentIndex === SLIDES.length - 1 ? (canReturn ? "Chiudi" : "Inizia") : "Vai avanti"}
                  onPress={goNext}
                  style={styles.ctaButton}
                >
                  <Text style={styles.ctaTitle}>{currentIndex === SLIDES.length - 1 ? (canReturn ? "Chiudi" : "Inizia") : "Avanti"}</Text>

                  <Animated.View style={[styles.ctaIconWrap, ctaArrowStyle]}>
                    <Feather
                      name={currentIndex === SLIDES.length - 1 ? "check" : "arrow-right"}
                      size={18}
                      color="#06070C"
                    />
                  </Animated.View>
                </Pressable>
              </Animated.View>
            </View>
          </View>
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#05070B",
  },
  backdropLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  ambientOrb: {
    position: "absolute",
    borderRadius: 999,
  },
  backdropOrbTop: {
    top: -82,
    left: -88,
  },
  backdropOrbRight: {
    top: "22%",
    right: -130,
  },
  backdropOrbBottom: {
    bottom: -96,
    left: -96,
  },
  textureGrid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.06,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    marginBottom: 8,
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#FF7A59",
  },
  brandText: {
    color: "#F8F7FF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  skipButton: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    color: "rgba(248,247,255,0.72)",
    fontSize: 15,
    fontWeight: "700",
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  heroShell: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  heroGlow: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.26,
  },
  heroFrame: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(10,12,18,0.62)",
    padding: 18,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.26,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 14,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  visualContent: {
    flex: 1,
    justifyContent: "center",
  },
  heroBadge: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroBadgeTop: {
    top: 14,
    right: 10,
  },
  heroBadgeText: {
    color: "#F8F7FF",
    fontSize: 12,
    fontWeight: "700",
  },
  copyBlock: {
    alignItems: "center",
    gap: 14,
  },
  labelPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 999,
  },
  labelText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 36,
    lineHeight: 40,
    textAlign: "center",
    fontWeight: "900",
    letterSpacing: -0.9,
  },
  subtitle: {
    maxWidth: 330,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    fontWeight: "600",
    marginTop: 14,
    paddingHorizontal: 12,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 24,
    paddingHorizontal: 18,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  footer: {
    paddingHorizontal: 22,
    gap: 18,
  },
  paginationRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  paginationDot: {
    height: 6,
    borderRadius: 999,
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonHidden: {
    opacity: 0,
  },
  ctaShell: {
    flex: 1,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  ctaButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 20,
    paddingRight: 12,
    paddingVertical: 14,
  },
  ctaTitle: {
    color: "#06070C",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  ctaIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  feedCardBack: {
    position: "absolute",
    top: 52,
    alignSelf: "center",
    width: "88%",
    height: "60%",
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  feedCardMain: {
    borderRadius: 26,
    padding: 18,
    backgroundColor: "rgba(7,9,14,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 16,
  },
  feedHighlightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  feedAccentBlock: {
    width: 56,
    height: 56,
    borderRadius: 18,
  },
  feedTextLines: {
    flex: 1,
    gap: 8,
  },
  feedLineStrong: {
    width: "80%",
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.86)",
  },
  feedLineSoft: {
    width: "56%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  feedScorePill: {
    minWidth: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  feedScoreText: {
    color: "#F8F7FF",
    fontSize: 15,
    fontWeight: "900",
  },
  feedEventRow: {
    flexDirection: "row",
    gap: 12,
  },
  feedMiniCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 6,
  },
  feedMiniTitle: {
    color: "rgba(248,247,255,0.58)",
    fontSize: 12,
    fontWeight: "700",
  },
  feedMiniSubtitle: {
    color: "#F8F7FF",
    fontSize: 16,
    fontWeight: "800",
  },
  feedMiniColumn: {
    width: 92,
    justifyContent: "center",
    gap: 10,
  },
  feedMiniBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  feedMiniBarShort: {
    width: "72%",
  },
  feedMiniBarAccent: {
    width: "54%",
  },
  feedFooterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  feedFooterBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  feedFooterText: {
    color: "rgba(248,247,255,0.72)",
    fontSize: 12,
    fontWeight: "700",
  },
  mapGrid: {
    flex: 1,
    borderRadius: 26,
    backgroundColor: "rgba(8,11,16,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  mapGridLineHorizontal: {
    position: "absolute",
    top: "28%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  mapGridLineMiddle: {
    top: "56%",
  },
  mapGridLineVertical: {
    position: "absolute",
    left: "32%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  mapGridLineRight: {
    left: "68%",
  },
  mapPulse: {
    position: "absolute",
    width: 116,
    height: 116,
    borderRadius: 999,
    borderWidth: 1,
    top: "26%",
    left: "50%",
    marginLeft: -58,
    marginTop: -58,
  },
  mapPinPrimary: {
    position: "absolute",
    top: "26%",
    left: "50%",
    marginLeft: -22,
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  mapPinSecondary: {
    position: "absolute",
    bottom: 92,
    right: 42,
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(99,167,255,0.9)",
  },
  mapRoute: {
    position: "absolute",
    top: "34%",
    right: 72,
    width: 110,
    height: 70,
    borderWidth: 2,
    borderColor: "transparent",
    borderTopColor: "rgba(255,255,255,0.26)",
    borderRightColor: "rgba(255,255,255,0.26)",
    borderRadius: 26,
  },
  mapStatsCard: {
    position: "absolute",
    left: 18,
    bottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  mapStatsValue: {
    color: "#F8F7FF",
    fontSize: 22,
    fontWeight: "900",
  },
  mapStatsLabel: {
    color: "rgba(248,247,255,0.62)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  socialPanel: {
    borderRadius: 26,
    padding: 18,
    backgroundColor: "rgba(8,11,16,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 16,
  },
  socialHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  socialTitle: {
    color: "#F8F7FF",
    fontSize: 18,
    fontWeight: "800",
  },
  socialStatusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  socialStatusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  socialAvatarsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 2,
  },
  socialAvatar: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(6,7,12,0.85)",
  },
  socialAvatarText: {
    color: "#05070B",
    fontWeight: "900",
    fontSize: 16,
  },
  voteCard: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  voteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  voteLabel: {
    color: "#F8F7FF",
    fontSize: 14,
    fontWeight: "700",
  },
  voteCount: {
    color: "rgba(248,247,255,0.82)",
    fontSize: 13,
    fontWeight: "800",
  },
  voteTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  voteFill: {
    height: "100%",
    borderRadius: 999,
  },
  qrTicket: {
    flex: 1,
    borderRadius: 26,
    padding: 18,
    backgroundColor: "rgba(8,11,16,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    justifyContent: "space-between",
  },
  qrTicketTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  qrLabel: {
    color: "rgba(248,247,255,0.56)",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  qrVenue: {
    color: "#F8F7FF",
    fontSize: 18,
    fontWeight: "900",
  },
  qrConfirmPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  qrConfirmText: {
    fontSize: 11,
    fontWeight: "800",
  },
  qrCodeShell: {
    alignSelf: "center",
    width: 132,
    height: 132,
    borderRadius: 24,
    padding: 12,
    backgroundColor: "#F8F7FF",
    justifyContent: "space-between",
  },
  qrCodeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  qrCell: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  qrCellDark: {
    backgroundColor: "#05070B",
  },
  qrCellLight: {
    backgroundColor: "#E6E4F0",
  },
  qrFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  qrFooterText: {
    color: "rgba(248,247,255,0.76)",
    fontSize: 13,
    fontWeight: "700",
  },
});

