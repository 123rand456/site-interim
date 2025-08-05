/// <reference types="astro/client" />

// Extend Astro's Locals interface to include our custom properties
declare namespace App {
  interface Locals {
    clientIP: string;
  }
}
