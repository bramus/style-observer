/**
 * Structure representing a single Style Observer Change
 *
 * ```js
 * {
 *   "value": "1.0",
 *   "previousValue": "0.5",
 *   "changed": true,
 *   "element": HTMLElement
 * }
 * ```
 */
interface StyleObserverChangeObject {
  value: string;
  previousValue: string | undefined;
  changed: boolean;
  element: HTMLElement;
}

/**
 * Structure holding several Style Observer Changes.
 *
 * ```js
 * {
 *   "--my-variable": {
 *     "value": "1.0",
 *     "previousValue": "0.5",
 *     "changed": true,
 *     "element": $element
 *   },
 *   "display": {
 *     "value": "block",
 *     "previousValue": "block",
 *     "changed": false,
 *     "element": $element
 *   }
 * }
 * ```
 */
type StyleObserverChangesWithObjects = {
  [key: string]: StyleObserverChangeObject;
};

/**
 * Structure holding several Style Observer Changes
 * with only their value
 *
 * ```json
 * {
 *   "--my-variable": "1.0",
 *   "display": "block",
 * }
 * ```
 */
type StyleObserverChangesWithValues = {
  [key: string]: StyleObserverChangeValue;
};
type StyleObserverChangeValue = string;

export type StyleObserverChanges =
  | StyleObserverChangesWithObjects
  | StyleObserverChangesWithValues;

/**
 * Type signature of observer callback.
 *
 * @param values Readonly structure containing observed CSS properties and their values
 */
export type StyleObserverCallback = (
  values: Readonly<StyleObserverChanges>
) => void;

/**
 * Type signatur for a formatter.
 * It is function that turns a set of StyleObserverChangesWithObjects into StyleObserverChanges
 */
type StyleObserverFormatter = (
  changes: StyleObserverChangesWithObjects
) => StyleObserverChanges;

type CachedValues = { [key: string]: string };

/**
 * Supported return formats
 */
export enum ReturnFormat {
  VALUE_ONLY = 'value_only',
  OBJECT = 'object',
}

/**
 * Possible notification modes
 */
export enum NotificationMode {
  CHANGED_ONLY = 'changed_only',
  ALL = 'all',
}

/**
 * Full configuration object
 */
export interface StyleObserverConfig {
  properties: string[];
  notificationMode?: NotificationMode;
  returnFormat?: ReturnFormat;
}

/**
 * Passive observer for CSS properties. Instead of typical polling approach, it uses CSS
 * transitions to detect changes.
 *
 * StyleObserver can be used to build dynamic theming system, detect media etc.
 *
 * Usage:
 * ```javascript
 * const styleObserver = new StyleObserver(['--my-variable'], (variables) => console.log("Value:",variables['--my-variable']));
 * styleObserver.attach(document.body);
 * ```
 */
export class StyleObserver {
  // List of elements that are being observed
  _observedElements: Set<HTMLElement> = new Set();

  // Value cache per observed element
  _cachedValues: WeakMap<HTMLElement, CachedValues> = new WeakMap();

  /**
   * Create a new (detached) instance of CSS variable observer.
   *
   * @param observedVariables list of CSS variables to observe
   * @param callback callback that will be invoked every time any of listed CSS variables change
   * @param options configuration options
   */
  constructor(
    callback: StyleObserverCallback,
    config: StyleObserverConfig = { properties: [] }
  ) {
    this._callback = callback;
    this._observedVariables = config.properties;
    this._notificationMode =
      config.notificationMode ?? NotificationMode.CHANGED_ONLY;
    this._returnFormat = config.returnFormat ?? ReturnFormat.OBJECT;
  }

  /**
   * Attach observer to target element. Callback will be invoked immediately with the current assigned values.
   *
   * @param targetElement target element
   */
  observe(targetElement: HTMLElement): void {
    if (!this._observedElements.has(targetElement)) {
      this._observedElements.add(targetElement);
      this._cachedValues.set(targetElement, {});

      this._setTargetElementStyles(targetElement);
      targetElement.addEventListener('transitionrun', this._eventHandler);

      // Make sure cache is not empty
      this._handleUpdate(targetElement);
    }
  }

  /**
   * Detach observer from given targetElement
   * If no argument is passed, then all are detached
   */
  unobserve(targetElement?: HTMLElement): void {
    // Figure out which elements to unwatch
    let elementsToUnobserve: Set<HTMLElement>;
    if (targetElement) {
      if (this._observedElements.has(targetElement)) {
        elementsToUnobserve = new Set([targetElement]);
      } else {
        elementsToUnobserve = new Set();
      }
    } else {
      elementsToUnobserve = this._observedElements;
    }

    // No elements to unwatch? Quit while you’re ahead
    if (!elementsToUnobserve.size) return;

    // Unwatch all that need unwatching
    elementsToUnobserve.forEach((elementToUnobserve) => {
      this._unsetTargetElementStyles(elementToUnobserve);
      elementToUnobserve.removeEventListener(
        'transitionrun',
        this._eventHandler
      );

      this._observedElements.delete(elementToUnobserve);
      this._cachedValues.delete(elementToUnobserve);
    });
  }

  /*
   * Observer CSS variables and their internal identifiers.
   */
  private _observedVariables: string[];

  /*
   * User supplied callback that receives CSS variable values.
   */
  private _callback: StyleObserverCallback;

  /*
   * Event handler that is used to invoke callback.
   */
  private _eventHandler = this._handleUpdate.bind(this);

  /*
   * Mode to determine whether to observe all properties or only the changed ones
   */
  private _notificationMode: NotificationMode;

  /*
   * Format to determine how to return the observed values
   */
  private _returnFormat: ReturnFormat;

  /**
   * Attach the styles necessary to track the changes to the given element
   *
   * @param targetElement The element to track
   */
  private _setTargetElementStyles(targetElement: HTMLElement): void {
    const cssTransitionValue = this._observedVariables
      .map((value) => `${value} 0.001ms step-start`)
      .join(', ');

    // @TODO: Don’t overwrite the existing transition
    targetElement.style.setProperty('transition', cssTransitionValue);
    targetElement.style.setProperty('transition-behavior', 'allow-discrete');
  }

  /**
   * Remove the styles that track the property changes
   *
   * @param targetElement The element to track
   */
  private _unsetTargetElementStyles(targetElement: HTMLElement): void {
    // @TODO: Don’t remove all, only remove the tracked variables
    targetElement.style.removeProperty('transition');
    targetElement.style.removeProperty('transition-behavior');
  }

  /**
   * Process the computed style and collect the changes
   *
   * @param computedStyle The computed style of the target element
   * @returns Collected changes
   */
  private _processComputedStyle(
    computedStyle: CSSStyleDeclaration,
    targetElement: HTMLElement
  ): StyleObserverChangesWithObjects {
    const changes: StyleObserverChangesWithObjects = {};
    const cachedValuesForElement = this._cachedValues.get(targetElement) ?? {};

    this._observedVariables.forEach((propertyName) => {
      const currentValue = computedStyle.getPropertyValue(propertyName);
      const previousValue = cachedValuesForElement[propertyName];
      const hasChanged = currentValue !== previousValue;

      if (this._notificationMode === NotificationMode.ALL || hasChanged) {
        changes[propertyName] = {
          value: currentValue,
          previousValue,
          changed: hasChanged,
          element: targetElement,
        };
        cachedValuesForElement[propertyName] = currentValue;
      }
    });

    return changes;
  }

  /**
   * Returns the formatter to use
   */
  private _getFormatter(format: ReturnFormat): StyleObserverFormatter {
    switch (format) {
      case ReturnFormat.OBJECT:
        return (changes) => {
          return changes;
        };

      case ReturnFormat.VALUE_ONLY:
      default:
        return (changes) => {
          const formattedChanges: StyleObserverChangesWithValues = {};
          Object.keys(changes).forEach((key) => {
            formattedChanges[key] = changes[key].value;
          });
          return formattedChanges;
        };
    }
  }

  /**
   * Collect CSS variable values and invoke callback.
   */
  private _handleUpdate(e: TransitionEvent | HTMLElement): void {
    const targetElement =
      e instanceof HTMLElement ? e : (e.target as HTMLElement);

    if (this._observedElements.has(targetElement)) {
      const computedStyle = getComputedStyle(targetElement);
      const changes = this._processComputedStyle(computedStyle, targetElement);

      if (Object.keys(changes).length === 0) return;

      const formatter = this._getFormatter(this._returnFormat);
      this._callback(formatter(changes));
    }
  }
}

export default StyleObserver;
