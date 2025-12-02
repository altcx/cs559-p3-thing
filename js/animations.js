// Animation system for UI and effects
import * as THREE from 'three';
import { scene } from './main.js';

// Easing functions
export const Easing = {
    // Linear
    linear: (t) => t,
    
    // Ease in
    easeInQuad: (t) => t * t,
    easeInCubic: (t) => t * t * t,
    // Ease out
    easeOutQuad: (t) => t * (2 - t),
    easeOutCubic: (t) => --t * t * t + 1,
    
    // Ease in-out
    easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    
    // Elastic
    elastic: (t) => {
        const p = 0.3;
        return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
    },
    
    // Bounce
    bounce: (t) => {
        if (t < 1 / 2.75) {
            return 7.5625 * t * t;
        } else if (t < 2 / 2.75) {
            return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
        } else if (t < 2.5 / 2.75) {
            return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
        } else {
            return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
        }
    }
};

// Animation state
let activeAnimations = [];

export function animateElement(element, property, startValue, endValue, duration, easing = Easing.easeOutCubic, onComplete = null) {
    const startTime = Date.now();
    const animation = {
        element,
        property,
        startValue,
        endValue,
        duration,
        easing,
        onComplete,
        startTime
    };
    
    activeAnimations.push(animation);
    
    return animation;
}

export function updateAnimations() {
    const currentTime = Date.now();
    
    activeAnimations = activeAnimations.filter(animation => {
        const elapsed = currentTime - animation.startTime;
        const progress = Math.min(elapsed / animation.duration, 1);
        const easedProgress = animation.easing(progress);
        
        const currentValue = animation.startValue + (animation.endValue - animation.startValue) * easedProgress;
        
        // Apply to element
        if (animation.element && animation.element.style) {
            if (animation.property === 'opacity') {
                animation.element.style.opacity = currentValue;
            } else if (animation.isTransform && animation.transformType === 'scale') {
                animation.element.style.transform = `scale(${currentValue})`;
            } else if (animation.property === 'transform') {
                animation.element.style.transform = currentValue;
            } else {
                animation.element.style[animation.property] = currentValue + 'px';
            }
        }
        
        // Check if complete
        if (progress >= 1) {
            if (animation.onComplete) {
                animation.onComplete();
            }
            return false; // Remove animation
        }
        
        return true; // Keep animation
    });
}

// Screen shake effect
let shakeIntensity = 0;
let shakeDuration = 0;
let shakeStartTime = 0;

export function triggerScreenShake(intensity = 10, duration = 500) {
    shakeIntensity = intensity;
    shakeDuration = duration;
    shakeStartTime = Date.now();
}

export function updateScreenShake(canvas) {
    if (!canvas) return;
    
    const elapsed = Date.now() - shakeStartTime;
    if (elapsed < shakeDuration) {
        const progress = elapsed / shakeDuration;
        const currentIntensity = shakeIntensity * (1 - progress); // Fade out
        const offsetX = (Math.random() - 0.5) * currentIntensity;
        const offsetY = (Math.random() - 0.5) * currentIntensity;
        
        canvas.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    } else {
        canvas.style.transform = 'translate(0px, 0px)';
    }
}

