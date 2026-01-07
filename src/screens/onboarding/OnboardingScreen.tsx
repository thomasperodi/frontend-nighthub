import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { useRef, useState, useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  withSpring,
  withTiming,
  Extrapolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import GradientBackground from "../../components/GradientBackground";
import PrimaryButton from "../../components/PrimaryButton";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingSlide {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  gradient: string[];
}

const onboardingData: OnboardingSlide[] = [
  {
    id: "1",
    emoji: "🌙",
    title: "Controlla la notte",
    subtitle: "Il tuo assistente per la vita notturna",
    description: "Gestisci tutto ciò che serve per rendere ogni serata indimenticabile, dal primo ingresso all'ultimo brindisi.",
    gradient: ["#2B1055", "#4B1D9C"],
  },
  {
    id: "2",
    emoji: "🎫",
    title: "Organizza ingressi e promo",
    subtitle: "Tutto sotto controllo",
    description: "Gestisci liste, biglietti e promozioni in tempo reale. Ogni ospite conta, ogni momento è importante.",
    gradient: ["#4B1D9C", "#6B2DD9"],
  },
  {
    id: "3",
    emoji: "🍾",
    title: "Gestisci tavoli e serate",
    subtitle: "Pianificazione perfetta",
    description: "Assegna tavoli, monitora prenotazioni e ottimizza ogni spazio. La tua serata organizzata al meglio.",
    gradient: ["#6B2DD9", "#8B4DFF"],
  },
  {
    id: "4",
    emoji: "✨",
    title: "Pronto a iniziare?",
    subtitle: "La notte ti aspetta",
    description: "Inizia subito a gestire le tue serate in modo professionale e intuitivo.",
    gradient: ["#8B4DFF", "#9B5CFF"],
  },
];

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<OnboardingSlide>);

export default function OnboardingScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);
  const fadeIn = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  useEffect(() => {
    fadeIn.value = withTiming(1, { duration: 600 });
  }, []);

  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: fadeIn.value,
    };
  });

  const goToNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate("Login");
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
      setCurrentIndex(prevIndex);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const SlideItem = ({ item, index }: { item: OnboardingSlide; index: number }) => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const animatedStyle = useAnimatedStyle(() => {
      const opacity = interpolate(
        scrollX.value,
        inputRange,
        [0.3, 1, 0.3],
        Extrapolate.CLAMP
      );

      const scale = interpolate(
        scrollX.value,
        inputRange,
        [0.8, 1, 0.8],
        Extrapolate.CLAMP
      );

      const translateY = interpolate(
        scrollX.value,
        inputRange,
        [50, 0, 50],
        Extrapolate.CLAMP
      );

      return {
        opacity: withTiming(opacity, { duration: 300 }),
        transform: [
          { scale: withSpring(scale, { damping: 15 }) },
          { translateY: withSpring(translateY, { damping: 15 }) },
        ],
      };
    });

    const emojiStyle = useAnimatedStyle(() => {
      const scale = interpolate(
        scrollX.value,
        inputRange,
        [0.5, 1, 0.5],
        Extrapolate.CLAMP
      );

      const rotate = interpolate(
        scrollX.value,
        inputRange,
        [-10, 0, 10],
        Extrapolate.CLAMP
      );

      return {
        transform: [
          { scale: withSpring(scale, { damping: 12 }) },
          { rotate: `${withSpring(rotate, { damping: 12 })}deg` },
        ],
      };
    });

    return (
      <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
        <Animated.View style={[styles.content, animatedStyle]}>
          <Animated.Text style={[styles.emoji, emojiStyle]}>{item.emoji}</Animated.Text>
          
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
          <Text style={styles.description}>{item.description}</Text>
        </Animated.View>
      </View>
    );
  };

  const PaginationDot = ({ index }: { index: number }) => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const dotStyle = useAnimatedStyle(() => {
      const width = interpolate(
        scrollX.value,
        inputRange,
        [8, 24, 8],
        Extrapolate.CLAMP
      );

      const opacity = interpolate(
        scrollX.value,
        inputRange,
        [0.4, 1, 0.4],
        Extrapolate.CLAMP
      );

      return {
        width: withSpring(width, { damping: 15 }),
        opacity: withTiming(opacity, { duration: 200 }),
      };
    });

    return <Animated.View style={[styles.dot, dotStyle]} />;
  };

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => {
    return <SlideItem item={item} index={index} />;
  };

  const renderPagination = () => {
    return (
      <View style={styles.pagination}>
        {onboardingData.map((_, index) => (
          <PaginationDot key={index} index={index} />
        ))}
      </View>
    );
  };

  return (
    <GradientBackground>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.container, { paddingTop: insets.top }, containerStyle]}>
        <AnimatedFlatList
          ref={flatListRef}
          data={onboardingData}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setCurrentIndex(index);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          keyExtractor={(item) => item.id}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />

        {renderPagination()}

        <View style={styles.footer}>
          {currentIndex > 0 && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={goToPrevious}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>Indietro</Text>
            </TouchableOpacity>
          )}

          <View style={styles.buttonContainer}>
            <PrimaryButton
              title={currentIndex === onboardingData.length - 1 ? "Inizia" : "Avanti"}
              onPress={goToNext}
            />
          </View>

          {currentIndex < onboardingData.length - 1 && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate("Login");
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>Salta</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  content: {
    alignItems: "center",
    width: "100%",
  },
  emoji: {
    fontSize: 100,
    marginBottom: 32,
    textAlign: "center",
  },
  title: {
    color: "white",
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "#B8A5FF",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  description: {
    color: "#E0D7FF",
    fontSize: 16,
    lineHeight: 26,
    textAlign: "center",
    paddingHorizontal: 16,
    opacity: 0.9,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 10,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "white",
    marginHorizontal: 4,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  buttonContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  skipText: {
    color: "#E0D7FF",
    fontSize: 16,
    fontWeight: "600",
  },
});
