<script setup lang="ts">
/** One stroke icon family for navigation and actions: 24px grid, round caps. */
defineProps<{
  name:
    | "today"
    | "todo-dump"
    | "habits"
    | "calendar"
    | "hierarchy"
    | "categories"
    | "history"
    | "settings"
    | "more"
    | "check"
    | "replan"
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
    | "close";
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
    <template v-else-if="name === 'todo-dump'">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </template>
    <template v-else-if="name === 'habits'">
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v4h-4" />
      <path d="m9 12 2 2 4-4" />
    </template>
    <template v-else-if="name === 'calendar'">
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </template>
    <template v-else-if="name === 'hierarchy'">
      <rect x="9" y="3" width="6" height="5" rx="1.5" />
      <rect x="3" y="16" width="6" height="5" rx="1.5" />
      <rect x="15" y="16" width="6" height="5" rx="1.5" />
      <path d="M12 8v4M6 16v-2h12v2" />
    </template>
    <template v-else-if="name === 'categories'">
      <path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9-8-8Z" />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </template>
    <template v-else-if="name === 'history'">
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3.5 4v4h4M12 8v4l3 2" />
    </template>
    <template v-else-if="name === 'settings'">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </template>
    <template v-else-if="name === 'more'">
      <circle cx="5.5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.2" fill="currentColor" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </template>
    <template v-else-if="name === 'replan'">
      <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5" />
      <path d="M20 4v4.5h-4.5" />
      <path d="M20 12a8 8 0 0 1-13.7 5.7L4 15.5" />
      <path d="M4 20v-4.5h4.5" />
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
