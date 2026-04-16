<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
</script>

<div class="container">
  <header class="nav">
    <h1><a href="/">tracker</a></h1>
    <nav>
      <a href="/" class:active={$page.url.pathname === '/'}>upcoming</a>
    </nav>
  </header>
  <slot />
</div>

<style>
  nav a.active {
    color: var(--text);
    background: var(--surface);
  }
</style>
