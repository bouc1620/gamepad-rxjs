# gamepad-rxjs

A wrapper around the Gamepad API that polls every 15 ms and exposes button and joystick events as RxJS observables.

## Install

`$ npm install gamepad-rxjs`;

## Usage

```js
import {
  GamepadObservables,
  ButtonEvent,
  JoystickDirectionEvent,
} from 'gamepad-rxjs';
import { merge, throttle, interval, map, distinctUntilChanged } from 'rxjs';

const player1 = new GamepadObservables(0);
const player2 = new GamepadObservables(1);

// Emits an event only when the button state changes (press or release).
// Button index 9 corresponds to the “Start” button — see the Gamepad API docs for mappings.
merge(player1.buttonPressed$(9), player1.buttonReleased$(9)).subscribe(
  ({ current }: ButtonEvent) => {
    console.log(
      `Player 1 just ${
        current.pressed ? 'pressed' : 'released'
      } the start button!`
    );
  }
);

// Each observable emits both the previous and current joystick state.
// This stream provides the joystick’s angle and pressure (0–1) instead of raw x/y values.
player2
  .joystickDirection$(0)
  .pipe(
    map(({ previous, current }: JoystickDirectionEvent) => {
      const delta = Math.round((previous.angle - current.angle) * 100) / 100;
      const quadrantPrevious = ~~(previous.angle / 90) + 1;
      const quadrantCurrent = ~~(current.angle / 90) + 1;

      return (quadrantPrevious === 1 && quadrantCurrent === 4) ||
        (delta > 0 && !(quadrantPrevious === 4 && quadrantCurrent === 1))
        ? 'clockwise'
        : 'counterclockwise';
    }),
    distinctUntilChanged(),
  )
  .subscribe((motion: 'clockwise' | 'counterclockwise') => {
    console.log(`Player 2 rotated the left joystick ${motion}.`);
  });

// Other observables emit only on state changes (button press/release or joystick movement).
// gamepadEvent$ emits a full snapshot of the gamepad state every 15 ms,
// allowing you to access the current state at any time.
player1.gamepadEvent$
  .pipe(throttle(() => interval(5000)))
  .subscribe((gamepad: Gamepad) => {
    console.log(`This is a snapshot of Player 1's gamepad state: `, gamepad);
  });
```


