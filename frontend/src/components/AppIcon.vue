<script setup lang="ts">
/** One stroke icon family for navigation and actions: 24px grid, round caps. */
defineProps<{
  name:
    | "today"
    | "plan"
    | "review"
    | "focus"
    | "questlog"
    | "dailies"
    | "calendar"
    | "campaigns"
    | "history"
    | "settings"
    | "more"
    | "check"
    | "tomorrow"
    | "chevron"
    | "chevron-left"
    | "chevron-down"
    | "plus"
    | "edit"
    | "trash"
    | "move"
    | "child"
    | "chart"
    | "timer"
    | "refresh"
    | "logout"
    | "search"
    | "filter"
    | "code"
    | "link"
    | "list"
    | "list-ordered"
    | "list-check"
    | "divider"
    | "close"
    | "skip"
    | "stop"
    | "play"
    | "pause"
    | "arrow-up"
    | "arrow-down"
    // Campaign icons (keys of CAMPAIGN_ICONS; "code" is above).
    | "book"
    | "dumbbell"
    | "heart"
    | "home"
    | "briefcase"
    | "graduation"
    | "music"
    | "leaf"
    | "money"
    | "wrench"
    | "pen"
    | "camera"
    | "globe"
    | "star"
    | "flag"
    | "bike"
    | "coffee"
    | "plane"
    | "palette"
    | "mountain"
    | "moon"
    | "people"
    | "chat"
    | "bulb"
    | "trophy"
    | "pot"
    | "gamepad"
    | "paw"
    | "laptop"
    | "map"
    | "drop";
}>();
</script>

<template>
  <svg
    class="app-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="name === 'today'">
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"
      />
    </template>
    <template v-else-if="name === 'focus'">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3" />
    </template>
    <template v-else-if="name === 'questlog'">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </template>
    <template v-else-if="name === 'dailies'">
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v4h-4" />
      <path d="m9 12 2 2 4-4" />
    </template>
    <template v-else-if="name === 'calendar'">
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </template>
    <template v-else-if="name === 'plan'">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9 4v16M15 4v16M5.5 8.5h1M11.5 8.5h1M17.5 8.5h1M11.5 12h1" />
    </template>
    <template v-else-if="name === 'review'">
      <path d="M4 20h16" />
      <path d="M7 16v-3M12 16V7M17 16v-6" />
    </template>
    <template v-else-if="name === 'campaigns'">
      <rect x="9" y="3" width="6" height="5" rx="1.5" />
      <rect x="3" y="16" width="6" height="5" rx="1.5" />
      <rect x="15" y="16" width="6" height="5" rx="1.5" />
      <path d="M12 8v4M6 16v-2h12v2" />
    </template>
    <template v-else-if="name === 'history'">
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3.5 4v4h4M12 8v4l3 2" />
    </template>
    <template v-else-if="name === 'settings'">
      <path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"
      />
      <circle cx="12" cy="12" r="3" />
    </template>
    <template v-else-if="name === 'more'">
      <circle cx="5.5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.2" fill="currentColor" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </template>
    <template v-else-if="name === 'tomorrow'">
      <path d="M4 12h13M13 7l5 5-5 5M20.5 5v14" />
    </template>
    <template v-else-if="name === 'chevron'">
      <path d="m9 6 6 6-6 6" />
    </template>
    <template v-else-if="name === 'chevron-left'">
      <path d="m15 6-6 6 6 6" />
    </template>
    <template v-else-if="name === 'chevron-down'">
      <path d="m6 9 6 6 6-6" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M12 5v14M5 12h14" />
    </template>
    <template v-else-if="name === 'skip'">
      <path d="M5 6l9 6-9 6Z" />
      <path d="M18.5 6v12" />
    </template>
    <template v-else-if="name === 'stop'">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </template>
    <template v-else-if="name === 'play'">
      <path d="M8 5.5v13l10.5-6.5Z" />
    </template>
    <template v-else-if="name === 'pause'">
      <path d="M9 5.5v13M15 5.5v13" />
    </template>
    <template v-else-if="name === 'edit'">
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </template>
    <template v-else-if="name === 'move'">
      <rect x="3.5" y="5" width="13" height="13" rx="3" />
      <path d="M3.5 9.5h13M14 14h7M18 11l3 3-3 3" />
    </template>
    <template v-else-if="name === 'child'">
      <path d="M6 4v9a3 3 0 0 0 3 3h9" />
      <path d="m15 13 3 3-3 3" />
    </template>
    <template v-else-if="name === 'chart'">
      <path d="M4 4v16h16" />
      <path d="m7 15 4-4 3 3 5-6" />
    </template>
    <template v-else-if="name === 'timer'">
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9v4l2.5 2M9.5 2.5h5" />
    </template>
    <template v-else-if="name === 'refresh'">
      <path d="M20 12a8 8 0 1 1-2.3-5.6L20 8.5" />
      <path d="M20 4v4.5h-4.5" />
    </template>
    <template v-else-if="name === 'logout'">
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </template>
    <template v-else-if="name === 'filter'">
      <path d="M4 7h16M7 12h10M10 17h4" />
    </template>
    <template v-else-if="name === 'code'">
      <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />
    </template>
    <template v-else-if="name === 'link'">
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3A4.5 4.5 0 0 0 13 4.6l-1 1" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
    </template>
    <template v-else-if="name === 'list'">
      <path d="M9.5 6H20M9.5 12H20M9.5 18H20" />
      <circle cx="4.5" cy="6" r="1.2" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="4.5" cy="18" r="1.2" fill="currentColor" />
    </template>
    <template v-else-if="name === 'list-ordered'">
      <path d="M10.5 6H20M10.5 12H20M10.5 18H20" />
      <path d="M3.5 5 5 4v5M3.5 9h3M3.5 15.2c.3-1.6 3-1.5 3 0 0 1.3-3 1.9-3 3.8h3" />
    </template>
    <template v-else-if="name === 'list-check'">
      <path d="M12.5 7H20M12.5 17H20" />
      <path d="m3.5 7 2 2 3.5-3.5M3.5 17l2 2L9 15.5" />
    </template>
    <template v-else-if="name === 'divider'">
      <path d="M3 12h18" />
      <path d="M7 6.5h10M7 17.5h10" stroke-dasharray="0.1 3.2" />
    </template>
    <template v-else-if="name === 'book'">
      <path d="M12 6.5C10.3 5.2 7.8 4.5 4 4.5v14c3.8 0 6.3.7 8 2 1.7-1.3 4.2-2 8-2v-14c-3.8 0-6.3.7-8 2Z" />
      <path d="M12 6.5v14" />
    </template>
    <template v-else-if="name === 'dumbbell'">
      <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />
    </template>
    <template v-else-if="name === 'heart'">
      <path d="M12 19.5s-7.5-4.4-7.5-9.7A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.2c0 5.3-7.5 9.7-7.5 9.7Z" />
    </template>
    <template v-else-if="name === 'home'">
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1Z" />
    </template>
    <template v-else-if="name === 'briefcase'">
      <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
      <path d="M9 7.5v-2A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2M3.5 12.5h17" />
    </template>
    <template v-else-if="name === 'graduation'">
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14Z" />
      <path d="M6.5 11.8v3.7c1.6 1.6 3.4 2.5 5.5 2.5s3.9-.9 5.5-2.5v-3.7M21.5 9.5v5" />
    </template>
    <template v-else-if="name === 'music'">
      <path d="M9 17.5V6l10-2v11.5" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <circle cx="16.5" cy="15.5" r="2.5" />
    </template>
    <template v-else-if="name === 'leaf'">
      <path d="M19.5 4.5c-9 0-14 4.5-14 11 0 1.6.4 2.8 1 3.5.7.6 1.9 1 3.5 1 6.5 0 9.5-5.5 9.5-15.5Z" />
      <path d="M4.5 19.5 13 11" />
    </template>
    <template v-else-if="name === 'money'">
      <rect x="3" y="6.5" width="18" height="11" rx="2.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 12h.01M17.5 12h.01" />
    </template>
    <template v-else-if="name === 'wrench'">
      <path d="M14.5 4.2a4.8 4.8 0 0 0-4.2 6.4l-6 6a2.1 2.1 0 0 0 3 3l6-6a4.8 4.8 0 0 0 6.4-4.2l-2.9 2.9-2.6-.4-.4-2.6Z" />
    </template>
    <template v-else-if="name === 'pen'">
      <path d="M12 3.5 6.5 10l2.5 7.5h6l2.5-7.5Z" />
      <path d="M12 3.5v6.5M9 20.5h6" />
      <circle cx="12" cy="11.5" r="1.5" />
    </template>
    <template v-else-if="name === 'camera'">
      <path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.5L9 4.5h6L16.5 7H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z" />
      <circle cx="12" cy="13" r="3.5" />
    </template>
    <template v-else-if="name === 'globe'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5Z" />
    </template>
    <template v-else-if="name === 'star'">
      <path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8Z" />
    </template>
    <template v-else-if="name === 'flag'">
      <path d="M5.5 20.5v-16M5.5 4.5h12l-2.5 4.5 2.5 4.5h-12" />
    </template>
    <template v-else-if="name === 'arrow-up'">
      <path d="M12 19V5M6 11l6-6 6 6" />
    </template>
    <template v-else-if="name === 'arrow-down'">
      <path d="M12 5v14M6 13l6 6 6-6" />
    </template>
    <template v-else-if="name === 'bike'">
      <circle cx="5.5" cy="16.5" r="3.5" />
      <circle cx="18.5" cy="16.5" r="3.5" />
      <path d="M5.5 16.5 9 9.5l3.5 7h-7M9 9.5h6.5l3 7M15.5 9.5l-1-3h2.5M9 9.5v-2M7.5 7.5h3" />
    </template>
    <template v-else-if="name === 'coffee'">
      <path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z" />
      <path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2M11 3.5v2M14 3.5v2" />
    </template>
    <template v-else-if="name === 'plane'">
      <path d="M20.5 3.5 3.5 10.5l7 3 3 7Z" />
      <path d="m10.5 13.5 4-4" />
    </template>
    <template v-else-if="name === 'palette'">
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.9 1.8-1.8 0-1.4-1.3-1.9-1.3-3.2 0-1 .8-1.8 1.8-1.8h2.2a4 4 0 0 0 4-4c0-3.4-3.8-6.2-8.5-6.2Z" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" />
      <circle cx="10" cy="7.5" r="1" fill="currentColor" />
      <circle cx="14.5" cy="7.5" r="1" fill="currentColor" />
    </template>
    <template v-else-if="name === 'mountain'">
      <path d="m3 19.5 6.5-11 4 6.5 2.5-3.5 5 8Z" />
      <path d="m7.6 11.8 1.9 1.4 1.8-1.5" />
    </template>
    <template v-else-if="name === 'moon'">
      <path d="M19.5 14.5a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z" />
    </template>
    <template v-else-if="name === 'people'">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M15.5 5.3a3 3 0 0 1 0 5.4M17.5 14.5a5.5 5.5 0 0 1 3 5" />
    </template>
    <template v-else-if="name === 'chat'">
      <path d="M6.5 4.5h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5v-3.5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
    </template>
    <template v-else-if="name === 'bulb'">
      <path d="M12 3.5a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1v2h6v-2c0-.4.1-.8.5-1.1A6 6 0 0 0 12 3.5Z" />
      <path d="M10 20.5h4" />
    </template>
    <template v-else-if="name === 'trophy'">
      <path d="M8 4.5h8v5a4 4 0 0 1-8 0Z" />
      <path d="M8 6.5H5.5a2.5 2.5 0 0 0 2.6 3.9M16 6.5h2.5a2.5 2.5 0 0 1-2.6 3.9M12 13.5v3.5M8.5 20h7l-.8-3H9.3Z" />
    </template>
    <template v-else-if="name === 'pot'">
      <path d="M4.5 10.5h15v6a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3Z" />
      <path d="M2.5 10.5h19M9 7.5h6M12 5.5v2" />
    </template>
    <template v-else-if="name === 'gamepad'">
      <path d="M7 7.5h10a4.5 4.5 0 0 1 4.4 5.4l-.8 4a2.4 2.4 0 0 1-4.1 1.1L14 15.5h-4l-2.5 2.5a2.4 2.4 0 0 1-4.1-1.1l-.8-4A4.5 4.5 0 0 1 7 7.5Z" />
      <path d="M7.5 10.5v3M6 12h3M15.5 11.5h.01M17.5 13h.01" />
    </template>
    <template v-else-if="name === 'paw'">
      <circle cx="6.8" cy="10" r="1.6" />
      <circle cx="10.2" cy="6.3" r="1.6" />
      <circle cx="13.8" cy="6.3" r="1.6" />
      <circle cx="17.2" cy="10" r="1.6" />
      <path d="M12 11.5c-2.5 0-5 3.6-5 5.8 0 1.4 1 2.2 2.3 2.2 1.1 0 1.7-.6 2.7-.6s1.6.6 2.7.6c1.3 0 2.3-.8 2.3-2.2 0-2.2-2.5-5.8-5-5.8Z" />
    </template>
    <template v-else-if="name === 'laptop'">
      <rect x="5" y="5" width="14" height="10" rx="1.5" />
      <path d="M3 18.5h18" />
    </template>
    <template v-else-if="name === 'map'">
      <path d="M9 5 3.5 7v12L9 17l6 2 5.5-2V5L15 7Z" />
      <path d="M9 5v12M15 7v12" />
    </template>
    <template v-else-if="name === 'drop'">
      <path d="M12 3.5s-6 6.6-6 10.9a6 6 0 0 0 12 0C18 10.1 12 3.5 12 3.5Z" />
    </template>
    <template v-else>
      <path d="M6 6l12 12M18 6 6 18" />
    </template>
  </svg>
</template>

<style scoped>
.app-icon {
  display: block;
  flex: none;
  width: 1.5rem;
  height: 1.5rem;
}
</style>
