import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

const queued: Array<() => void> = [];

function flushQueue() {
  while (queued.length && navigationRef.isReady()) {
    const fn = queued.shift();
    try {
      fn && fn();
    } catch {
      // ignore
    }
  }
}

export function navigate(name: string, params?: any) {
  const action = () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore navigationRef typing is too strict here for simple helper
    navigationRef.navigate(name, params);
  };

  if (navigationRef.isReady()) action();
  else queued.push(action);
}

export function resetTo(name: string, params?: any) {
  const action = () => {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name, params }],
      }),
    );
  };

  if (navigationRef.isReady()) action();
  else queued.push(action);
}

// Automatically flush when ref becomes ready
// Consumers should call this in App.tsx via onReady prop on NavigationContainer
export function flushNavigationQueue() {
  flushQueue();
}
