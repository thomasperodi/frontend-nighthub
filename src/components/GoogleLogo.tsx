import React from "react";
import Svg, { Path } from "react-native-svg";

export default function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.7 0 6.3 1.6 7.7 2.9l5.6-5.6C34 3.2 29.4 1.5 24 1.5 14.7 1.5 6.9 6.7 3.4 14.2l6.9 5.3C12.5 15 17.7 9.5 24 9.5z"
      />
      <Path
        fill="#34A853"
        d="M46.5 24c0-1.6-.1-2.9-.3-4.2H24v8h12.6c-.5 2.7-2 5-4.5 6.6l7 5.4C44.6 36.6 46.5 30.9 46.5 24z"
      />
      <Path
        fill="#FBBC05"
        d="M10.3 29.5c-.6-1.7-1-3.5-1-5.5s.4-3.8 1-5.5L3.4 14.2C1.2 18.2 0 22.9 0 24c0 1.1 1.2 5.8 3.4 9.8l6.9-4.3z"
      />
      <Path
        fill="#4285F4"
        d="M24 46.5c5.4 0 10-1.8 13.4-4.9l-7-5.4c-2 1.3-4.6 2.1-6.4 2.1-6.3 0-11.5-5.5-12.3-12.7l-6.9 4.3C6.9 41.8 14.7 46.5 24 46.5z"
      />
    </Svg>
  );
}
