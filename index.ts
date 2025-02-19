import {
  animationFrameScheduler,
  shareReplay,
  Observable,
  fromEvent,
  switchMap,
  takeUntil,
  pairwise,
  interval,
  concat,
  filter,
  map,
  of,
} from 'rxjs';

export interface ButtonEvent {
  previous: GamepadButton;
  current: GamepadButton;
}

export interface JoystickCoordinates {
  x: number;
  y: number;
}

export interface JoystickCoordinatesEvent {
  previous: JoystickCoordinates;
  current: JoystickCoordinates;
}

export interface JoystickDirection {
  angle: number;
  pressure: number;
}

export interface JoystickDirectionEvent {
  previous: JoystickDirection;
  current: JoystickDirection;
}

const idleGamepad = Object.freeze({
  axes: Array.from({ length: 2 }).map(() => 0),
  buttons: Array.from({ length: 17 }).map(() => ({
    pressed: false,
    touched: false,
    value: 0,
  })),
} as unknown as Gamepad);

const getAngleFromCoordinates = (x: number, y: number): number =>
  ((Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2)) * (180 / Math.PI);

export class GamepadObservables {
  #gamepadConnected$: Observable<Gamepad> = fromEvent(
    window,
    'gamepadconnected'
  ).pipe(map(() => idleGamepad));

  /**
   * RxJs Observable emmiting the polled Gamepad state every 15 milliseconds
   * @type {Observable<Gamepad>}
   * */
  gamepadEvent$: Observable<Gamepad> = this.#gamepadConnected$.pipe(
    switchMap((gamepad) =>
      concat(
        of(gamepad),
        interval(15, animationFrameScheduler).pipe(
          map(() => window.navigator.getGamepads()[this.#gamepadIndex]!)
        )
      )
    ),
    takeUntil(fromEvent(window, 'gamepaddisconnected')),
    shareReplay(1)
  );

  #gamepadIndex: number;
  #buttonsObservables: ReadonlyArray<{
    pressed$: Observable<ButtonEvent>;
    released$: Observable<ButtonEvent>;
    change$: Observable<ButtonEvent>;
  }>;
  #joystickObservables: ReadonlyArray<{
    coordinates$: Observable<JoystickCoordinatesEvent>;
    direction$: Observable<JoystickDirectionEvent>;
  }>;

  /**
   * @param {number} gamepadIndex - 0 to 2 inclusive, the index of the gamepad to observe
   */
  constructor(gamepadIndex: number) {
    this.#gamepadIndex = gamepadIndex;

    if (!window.navigator.getGamepads) {
      throw Error('the gamepad api is not available');
    }

    this.#buttonsObservables = Array.from({
      length: 17,
    }).map((_, i) => {
      const buttonEvent$ = this.gamepadEvent$.pipe(
        map((gamepad) => ({
          pressed: gamepad.buttons[i].pressed,
          touched: gamepad.buttons[i].touched,
          value: gamepad.buttons[i].value,
        }))
      );

      const pressedChange$ = buttonEvent$.pipe(
        pairwise(),
        filter(([previous, current]) => previous.pressed !== current.pressed),
        map(([previous, current]) => ({
          previous,
          current,
        }))
      );

      return {
        pressed$: pressedChange$.pipe(filter(({ current }) => current.pressed)),
        released$: pressedChange$.pipe(
          filter(({ current }) => !current.pressed)
        ),
        change$: buttonEvent$.pipe(
          pairwise(),
          filter(([previous, current]) => previous.value !== current.value),
          map(([previous, current]) => ({
            previous,
            current,
          }))
        ),
      };
    });

    this.#joystickObservables = Array.from({
      length: 2,
    }).map((_, i) => {
      const joystickEvent$ = this.gamepadEvent$.pipe(
        map((gamepad) => ({
          x: gamepad.axes[i * 2],
          y: gamepad.axes[i * 2 + 1] * -1,
        }))
      );

      return {
        coordinates$: joystickEvent$.pipe(
          pairwise(),
          filter(
            ([previous, current]) =>
              previous.x !== current.x || previous.y !== current.y
          ),
          map(([previous, current]) => ({
            previous,
            current,
          }))
        ),
        direction$: joystickEvent$.pipe(
          map(({ x, y }) => {
            const pressure = Math.sqrt(x ** 2 + y ** 2);

            return {
              angle: getAngleFromCoordinates(x, y),
              pressure: pressure >= 0.975 ? 1 : pressure,
            };
          }),
          pairwise(),
          filter(([previous, current]) => previous.angle !== current.angle),
          map(([previous, current]) => ({
            previous,
            current,
          }))
        ),
      };
    });
  }

  /**
   * @param {number} buttonIndex - 0 to 16 inclusive, the index of the button to observe
   * @returns {Observable<ButtonEvent>} - RxJs Observable emmiting when the button changes from released to pressed
   */
  buttonPressed$(buttonIndex: number): Observable<ButtonEvent> {
    return this.#buttonsObservables[buttonIndex].pressed$;
  }

  /**
   * @param {number} buttonIndex - 0 to 16 inclusive, the index of the button to observe
   * @returns {Observable<ButtonEvent>} - RxJs Observable emmiting when the button changes from pressed to released
   */
  buttonReleased$(buttonIndex: number): Observable<ButtonEvent> {
    return this.#buttonsObservables[buttonIndex].released$;
  }

  /**
   * @param {number} buttonIndex - 0 to 16 inclusive, the index of the button to observe
   * @returns {Observable<ButtonEvent>} - RxJs Observable emmiting when the GamepadButton.value analog property defining the pressure changes
   */
  buttonChange$(buttonIndex: number): Observable<ButtonEvent> {
    return this.#buttonsObservables[buttonIndex].change$;
  }

  /**
   * @param {number} joystickIndex - 0 or 1, the index of the joystick to observe
   * @returns {Observable<JoystickCoordinatesEvent>} - RxJs Observable emmiting the joystick's x and y coordinates when they change
   */
  joystickMoved$(joystickIndex: number): Observable<JoystickCoordinatesEvent> {
    return this.#joystickObservables[joystickIndex].coordinates$;
  }

  /**
   * @param {number} joystickIndex - 0 or 1, the index of the joystick to observe
   * @returns {Observable<JoystickDirectionEvent>} - RxJs Observable emmiting the joystick's angle in degrees when it changes
   */
  joystickDirection$(
    joystickIndex: number
  ): Observable<JoystickDirectionEvent> {
    return this.#joystickObservables[joystickIndex].direction$;
  }
}
