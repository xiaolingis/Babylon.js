﻿module BABYLON {

    /**
     * Defines a runtime animation
     */
    export class RuntimeAnimation {
        /**
         * The current frame of the runtime animation
         */
        private _currentFrame: number = 0;

        /**
         * The animation used by the runtime animation
         */
        private _animation: Animation;
        
        /**
         * The target of the runtime animation
         */
        private _target: any;

        /**
         * The initiating animatable
         */
        private _host: Animatable;
        
        /**
         * The original value of the runtime animation
         */
        private _originalValue: any;
        
        /**
         * The original blend value of the runtime animation
         */
        private _originalBlendValue: any;
        
        /**
         * The offsets cache of the runtime animation
         */
        private _offsetsCache: {[key: string]: any} = {};
        
        /**
         * The high limits cache of the runtime animation
         */
        private _highLimitsCache: {[key: string]: any} = {};
        
        /**
         * Specifies if the runtime animation has been stopped
         */
        private _stopped = false;
        
        /**
         * The blending factor of the runtime animation
         */
        private _blendingFactor = 0;
        
        /**
         * The BabylonJS scene
         */
        private _scene: Scene;

        /**
         * The current value of the runtime animation
         */
        private _currentValue: any;
        
        /** @hidden */
        public _workValue: any;
        
        /**
         * The active target of the runtime animation
         */
        private _activeTarget: any;
        
        /**
         * The target path of the runtime animation
         */
        private _targetPath: string = "";
        
        /**
         * The weight of the runtime animation
         */
        private _weight = 1.0;

        /**
         * The ratio offset of the runtime animation
         */
        private _ratioOffset = 0;

        /**
         * The previous delay of the runtime animation
         */
        private _previousDelay: number = 0;
        
        /**
         * The previous ratio of the runtime animation
         */
        private _previousRatio: number = 0;

        /**
         * Gets the current frame of the runtime animation
         */
        public get currentFrame(): number {
            return this._currentFrame;
        }

        /**
         * Gets the weight of the runtime animation
         */
        public get weight(): number {
            return this._weight;
        }           

        /**
         * Gets the original value of the runtime animation
         */
        public get originalValue(): any {
            return this._originalValue;
        }        

        /**
         * Gets the current value of the runtime animation
         */
        public get currentValue(): any {
            return this._currentValue;
        }

        /**
         * Gets the target path of the runtime animation
         */
        public get targetPath(): string {
            return this._targetPath;
        }

        /**
         * Gets the actual target of the runtime animation
         */
        public get target(): any {
            return this._activeTarget;
        }

        /**
         * Create a new RuntimeAnimation object
         * @param target defines the target of the animation
         * @param animation defines the source animation object
         * @param scene defines the hosting scene
         * @param host defines the initiating Animatable
         */
        public constructor(target: any, animation: Animation, scene: Scene, host: Animatable) {
            this._animation = animation;
            this._target = target;
            this._scene = scene;
            this._host = host;

            animation._runtimeAnimations.push(this);
        }

        /**
         * Gets the animation from the runtime animation
         */
        public get animation(): Animation {
            return this._animation;
        }

        /**
         * Resets the runtime animation to the beginning
         */
        public reset(): void {
            this._offsetsCache = {};
            this._highLimitsCache = {};
            this._currentFrame = 0;
            this._blendingFactor = 0;
            this._originalValue = null;
        }

        /**
         * Specifies if the runtime animation is stopped
         * @returns Boolean specifying if the runtime animation is stopped
         */
        public isStopped(): boolean {
            return this._stopped;
        }        

        /**
         * Disposes of the runtime animation
         */
        public dispose(): void {
            let index = this._animation.runtimeAnimations.indexOf(this);

            if (index > -1) {
                this._animation.runtimeAnimations.splice(index, 1);
            }
        }
        
        /**
         * Interpolates the animation from the current frame
         * @param currentFrame The frame to interpolate the animation to
         * @param repeatCount The number of times that the animation should loop
         * @param loopMode The type of looping mode to use
         * @param offsetValue Animation offset value
         * @param highLimitValue The high limit value
         * @returns The interpolated value
         */
        private _interpolate(currentFrame: number, repeatCount: number, loopMode?: number, offsetValue?: any, highLimitValue?: any): any {
            this._currentFrame = currentFrame;

            if (this._animation.dataType === Animation.ANIMATIONTYPE_MATRIX && !this._workValue) {
                this._workValue = Matrix.Zero();
            }

            return this._animation._interpolate(currentFrame, repeatCount, this._workValue, loopMode, offsetValue, highLimitValue);
        }

        /**
         * Affect the interpolated value to the target
         * @param currentValue defines the value computed by the animation
         * @param weight defines the weight to apply to this value
         */
        public setValue(currentValue: any, weight = 1.0): void {
            if (this._target instanceof Array) {
                for (const target of this._target) {
                    this._setValue(target, currentValue, weight);
                }
            }
            else {
                this._setValue(this._target, currentValue, weight);
            }
        }

        /**
         * Sets the value of the runtime animation
         * @param target The target property of the runtime animation
         * @param currentValue The current value to use for the runtime animation
         * @param weight The weight to use for the runtime animation (Defaults to 1.0)
         */
        private _setValue(target: any, currentValue: any, weight = 1.0): void {
            // Set value
            var path: any;
            var destination: any;

            let targetPropertyPath = this._animation.targetPropertyPath

            if (targetPropertyPath.length > 1) {
                var property = target[targetPropertyPath[0]];

                for (var index = 1; index < targetPropertyPath.length - 1; index++) {
                    property = property[targetPropertyPath[index]];
                }

                path =  targetPropertyPath[targetPropertyPath.length - 1];
                destination = property;
            } else {
                path = targetPropertyPath[0];
                destination = target;
            }

            this._targetPath = path;
            this._activeTarget = destination;
            this._weight = weight;

            // Blending
            let enableBlending = target && target.animationPropertiesOverride ? target.animationPropertiesOverride.enableBlending : this._animation.enableBlending;
            let blendingSpeed = target && target.animationPropertiesOverride ? target.animationPropertiesOverride.blendingSpeed : this._animation.blendingSpeed;
            
            if (enableBlending && this._blendingFactor <= 1.0) {
                if (!this._originalBlendValue) {
                    let originalValue = destination[path];

                    if (originalValue.clone) {
                        this._originalBlendValue = originalValue.clone();
                    } else {
                        this._originalBlendValue = originalValue;
                    }
                }
            }

            if (weight !== -1.0) {
                if (!this._originalValue) {
                    let originalValue: any;

                    if (destination.getRestPose && path === "_matrix") { // For bones
                        originalValue = destination.getRestPose();
                    } else {
                        originalValue = destination[path];
                    }

                    if (originalValue.clone) {
                        this._originalValue = originalValue.clone();
                    } else {
                        this._originalValue = originalValue;
                    }
                }
            }

            if (enableBlending && this._blendingFactor <= 1.0) {
                if (this._originalBlendValue.m) { // Matrix
                    if (Animation.AllowMatrixDecomposeForInterpolation) {
                        if (this._currentValue) {
                            Matrix.DecomposeLerpToRef(this._originalBlendValue, currentValue, this._blendingFactor, this._currentValue);
                        } else {
                            this._currentValue = Matrix.DecomposeLerp(this._originalBlendValue, currentValue, this._blendingFactor);
                        }
                    } else {
                        if (this._currentValue) {
                            Matrix.LerpToRef(this._originalBlendValue, currentValue, this._blendingFactor, this._currentValue);
                        } else {
                            this._currentValue = Matrix.Lerp(this._originalBlendValue, currentValue, this._blendingFactor);
                        }
                    }
                } else { 
                    let constructor = this._originalBlendValue.constructor;
                    if (constructor.Lerp) { // Lerp supported
                        this._currentValue = constructor.Lerp(this._originalBlendValue, currentValue, this._blendingFactor);
                    } else if (constructor.Slerp) { // Slerp supported
                        this._currentValue = constructor.Slerp(this._originalBlendValue, currentValue, this._blendingFactor);
                    } else if (this._originalBlendValue.toFixed) { // Number
                        this._currentValue = this._originalBlendValue * (1.0 - this._blendingFactor) + this._blendingFactor * currentValue;
                    } else { // Blending not supported
                        this._currentValue = currentValue;
                    }
                }
                this._blendingFactor += blendingSpeed;
            } else {
                this._currentValue = currentValue;
            }

            if (weight !== -1.0) {
                this._scene._registerTargetForLateAnimationBinding(this);
            } else {
                destination[path] = this._currentValue;
            }

            if (target.markAsDirty) {
                target.markAsDirty(this._animation.targetProperty);
            }
        }

        /**
         * Gets the loop pmode of the runtime animation
         * @returns Loop Mode
         */
        private _getCorrectLoopMode(): number | undefined {
            if ( this._target && this._target.animationPropertiesOverride) {
                return this._target.animationPropertiesOverride.loopMode;
            }

            return this._animation.loopMode;
        }

        /**
         * Move the current animation to a given frame
         * @param frame defines the frame to move to
         */
        public goToFrame(frame: number): void {
            let keys = this._animation.getKeys();

            if (frame < keys[0].frame) {
                frame = keys[0].frame;
            } else if (frame > keys[keys.length - 1].frame) {
                frame = keys[keys.length - 1].frame;
            }

            var currentValue = this._interpolate(frame, 0, this._getCorrectLoopMode());

            this.setValue(currentValue, -1);
        }

        /**
         * @hidden Internal use only
         */
        public _prepareForSpeedRatioChange(newSpeedRatio: number): void {
            let newRatio = this._previousDelay * (this._animation.framePerSecond * newSpeedRatio) / 1000.0;

            this._ratioOffset = this._previousRatio - newRatio;
        }

        /**
         * Execute the current animation
         * @param delay defines the delay to add to the current frame
         * @param from defines the lower bound of the animation range
         * @param to defines the upper bound of the animation range
         * @param loop defines if the current animation must loop
         * @param speedRatio defines the current speed ratio
         * @param weight defines the weight of the animation (default is -1 so no weight)
         * @returns a boolean indicating if the animation has ended
         */
        public animate(delay: number, from: number, to: number, loop: boolean, speedRatio: number, weight = -1.0): boolean {
            let targetPropertyPath = this._animation.targetPropertyPath
            if (!targetPropertyPath || targetPropertyPath.length < 1) {
                this._stopped = true;
                return false;
            }
            var returnValue = true;
            let keys = this._animation.getKeys();

            // Adding a start key at frame 0 if missing
            if (keys[0].frame !== 0) {
                var newKey = { frame: 0, value: keys[0].value };
                keys.splice(0, 0, newKey);
            }

            // Check limits
            if (from < keys[0].frame || from > keys[keys.length - 1].frame) {
                from = keys[0].frame;
            }
            if (to < keys[0].frame || to > keys[keys.length - 1].frame) {
                to = keys[keys.length - 1].frame;
            }

            //to and from cannot be the same key
            if(from === to) {
                if (from > keys[0].frame) {
                    from--;
                } else if (to < keys[keys.length - 1].frame) {
                    to++;
                }
            }
            
            // Compute ratio
            var range = to - from;
            var offsetValue;
            // ratio represents the frame delta between from and to
            var ratio = (delay * (this._animation.framePerSecond * speedRatio) / 1000.0) + this._ratioOffset;
            var highLimitValue = 0;

            this._previousDelay = delay;
            this._previousRatio = ratio;

            if (((to > from && ratio > range) || (from > to && ratio < range)) && !loop) { // If we are out of range and not looping get back to caller
                returnValue = false;
                highLimitValue = this._animation._getKeyValue(keys[keys.length - 1].value);
            } else {
                // Get max value if required

                if (this._getCorrectLoopMode() !== Animation.ANIMATIONLOOPMODE_CYCLE) {

                    var keyOffset = to.toString() + from.toString();
                    if (!this._offsetsCache[keyOffset]) {
                        var fromValue = this._interpolate(from, 0, Animation.ANIMATIONLOOPMODE_CYCLE);
                        var toValue = this._interpolate(to, 0, Animation.ANIMATIONLOOPMODE_CYCLE);
                        switch (this._animation.dataType) {
                            // Float
                            case Animation.ANIMATIONTYPE_FLOAT:
                                this._offsetsCache[keyOffset] = toValue - fromValue;
                                break;
                            // Quaternion
                            case Animation.ANIMATIONTYPE_QUATERNION:
                                this._offsetsCache[keyOffset] = toValue.subtract(fromValue);
                                break;
                            // Vector3
                            case Animation.ANIMATIONTYPE_VECTOR3:
                                this._offsetsCache[keyOffset] = toValue.subtract(fromValue);
                            // Vector2
                            case Animation.ANIMATIONTYPE_VECTOR2:
                                this._offsetsCache[keyOffset] = toValue.subtract(fromValue);
                            // Size
                            case Animation.ANIMATIONTYPE_SIZE:
                                this._offsetsCache[keyOffset] = toValue.subtract(fromValue);
                            // Color3
                            case Animation.ANIMATIONTYPE_COLOR3:
                                this._offsetsCache[keyOffset] = toValue.subtract(fromValue);
                            default:
                                break;
                        }

                        this._highLimitsCache[keyOffset] = toValue;
                    }

                    highLimitValue = this._highLimitsCache[keyOffset];
                    offsetValue = this._offsetsCache[keyOffset];
                }
            }

            if (offsetValue === undefined) {
                switch (this._animation.dataType) {
                    // Float
                    case Animation.ANIMATIONTYPE_FLOAT:
                        offsetValue = 0;
                        break;
                    // Quaternion
                    case Animation.ANIMATIONTYPE_QUATERNION:
                        offsetValue = new Quaternion(0, 0, 0, 0);
                        break;
                    // Vector3
                    case Animation.ANIMATIONTYPE_VECTOR3:
                        offsetValue = Vector3.Zero();
                        break;
                    // Vector2
                    case Animation.ANIMATIONTYPE_VECTOR2:
                        offsetValue = Vector2.Zero();
                        break;
                    // Size
                    case Animation.ANIMATIONTYPE_SIZE:
                        offsetValue = Size.Zero();
                        break;
                    // Color3
                    case Animation.ANIMATIONTYPE_COLOR3:
                        offsetValue = Color3.Black();
                }
            }

            // Compute value
            var repeatCount = (ratio / range) >> 0;
            var currentFrame = returnValue ? from + ratio % range : to;

            // Need to normalize?
            if (this._host && this._host.syncRoot) {
                let syncRoot = this._host.syncRoot;
                let hostNormalizedFrame = (syncRoot.masterFrame - syncRoot.fromFrame) / (syncRoot.toFrame - syncRoot.fromFrame);
                currentFrame = from + (to - from) * hostNormalizedFrame;
            }

            var currentValue = this._interpolate(currentFrame, repeatCount, this._getCorrectLoopMode(), offsetValue, highLimitValue);

            // Set value
            this.setValue(currentValue, weight);

            // Check events
            let events = this._animation.getEvents();
            for (var index = 0; index < events.length; index++) {
                // Make sure current frame has passed event frame and that event frame is within the current range
                // Also, handle both forward and reverse animations
                if (
                    (range > 0 && currentFrame >= events[index].frame && events[index].frame >= from) ||
                    (range < 0 && currentFrame <= events[index].frame && events[index].frame <= from)
                ){
                    var event = events[index];
                    if (!event.isDone) {
                        // If event should be done only once, remove it.
                        if (event.onlyOnce) {
                            events.splice(index, 1);
                            index--;
                        }
                        event.isDone = true;
                        event.action();
                    } // Don't do anything if the event has already be done.
                } else if (events[index].isDone && !events[index].onlyOnce) {
                    // reset event, the animation is looping
                    events[index].isDone = false;
                }
            }
            if (!returnValue) {
                this._stopped = true;
            }

            return returnValue;
        }
    }
} 


