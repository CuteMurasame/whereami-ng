<template>
  <div class="layout-container">
      
      <aside class="sidebar">
        <div class="brand" @click="router.push('/lobby')">
          <i class="fa-solid fa-map-location-dot"></i> WhereAmI
        </div>
        
        <div class="user-profile">
          <div class="avatar-wrapper" @click="triggerUpload">
            <img :src="currentAvatar" alt="Avatar" class="avatar-img" />
            <div class="avatar-overlay"><i class="fa-solid fa-eye"></i></div>
          </div>
          
          <input 
            type="file" 
            ref="fileInput" 
            style="display: none" 
            accept="image/*"
            @change="handleFileChange"
          />

          <div class="user-info">
            <RatingName v-if="user" :user="user" class="u-name" />
            <span class="u-role">
              {{ user?.is_banned ? 'BANNED' : (user?.is_root ? 'Root' : (user?.is_admin ? 'Admin' : 'Explorer')) }}
            </span>
          </div>
        </div>

        <nav class="nav-links">
          <button 
            @click="router.push('/lobby')" 
            :class="['nav-item', page === 'lobby' ? 'active' : '']"
          >
            <i class="fa-solid fa-gamepad"></i> {{ t('nav.lobby') }}
          </button>

          <button 
            @click="router.push('/maps')" 
            :class="['nav-item', page === 'maps' ? 'active' : '']"
          >
            <i class="fa-solid fa-map"></i> {{ t('nav.maps') }}
          </button>
          
          <button 
            @click="router.push('/duels')" 
            :class="['nav-item', page === 'duels' ? 'active' : '']"
          >
            <i class="fa-solid fa-fire"></i> {{ t('lobby.duels') }}
          </button>
          
          <button 
            @click="router.push('/settings')" 
            :class="['nav-item', page === 'settings' ? 'active' : '']"
          >
            <i class="fa-solid fa-gear"></i> {{ t('nav.settings') }}
          </button>

          <button 
            @click="router.push('/statistics')" 
            :class="['nav-item', page === 'statistics' ? 'active' : '']"
          >
            <i class="fa-solid fa-chart-pie"></i> {{ t('statistics.title') }}
          </button>

          <button 
            v-if="user?.is_admin || user?.is_root" 
            @click="router.push('/admin')" 
            :class="['nav-item', page === 'admin' ? 'active' : '', 'admin-link']"
          >
            <i class="fa-solid fa-toolbox"></i> {{ t('nav.admin') }}
          </button>
        </nav>

        <div class="sidebar-footer">
          <div class="footer-controls">
            <LanguageSwitcher class="footer-language" />
            <button @click="toggleTheme" class="layout-theme-toggle" title="Toggle theme">
              <i v-if="isDark" class="fa-solid fa-sun"></i>
              <i v-else class="fa-solid fa-moon"></i>
            </button>
          </div>
          <button @click="handleLogout" class="back-btn">
            <i class="fa-solid fa-right-from-bracket"></i> {{ t('nav.logout') }}
          </button>
        </div>
      </aside>

      <main class="content-area">
        <slot></slot>
      </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { authState, api } from '../auth';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import LanguageSwitcher from './LanguageSwitcher.vue';
import RatingName from './RatingName.vue';

const { t } = useI18n();
const props = defineProps(['page']); // 接收当前页面名称
const router = useRouter();
const user = computed(() => authState.user);
const fileInput = ref(null);
const currentAvatar = computed(() => authState.getAvatar(user.value));
const isDark = ref(
  localStorage.getItem('theme') === 'dark'
  || (!localStorage.getItem('theme') && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
);

const toggleTheme = () => {
  isDark.value = !isDark.value;
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light');
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
};

const goToPublicProfile = () => {
  if (user.value) router.push(`/user/${user.value.id}`);
};

const handleLogout = () => { authState.logout(); router.push('/login'); };

// 上传相关逻辑保持不变，供子组件调用或未来扩展
const triggerUpload = () => fileInput.value.click(); // 可通过 expose 暴露给父组件，或者在Settings里单独写
const processImage = (file) => {
  return new Promise((resolve, reject) => {
    const MAX_WIDTH = 1024;
    const MAX_HEIGHT = 1024;
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      
      // Check if processing is needed
      if (width <= MAX_WIDTH && height <= MAX_HEIGHT && file.size <= MAX_SIZE) {
        resolve(file);
        return;
      }

      // Calculate new dimensions
      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Start with high quality
      let quality = 0.9;
      
      const tryCompress = (q) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error("Canvas to Blob failed"));
                return;
            }
            if (blob.size <= MAX_SIZE || q <= 0.1) {
                resolve(new File([blob], file.name, { type: file.type }));
            } else {
                // If still too big, reduce quality
                tryCompress(q - 0.1);
            }
        }, file.type, q);
      };
      
      tryCompress(quality);
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const handleFileChange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const processedFile = await processImage(file);
    
    const formData = new FormData();
    formData.append('avatar', processedFile);

    const res = await api.post('/user/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    // Update local user state
    if (user.value) {
      const updatedUser = { ...user.value, avatar_url: res.data.avatar_url };
      authState.setSession(authState.token, updatedUser);
    }
  } catch (err) {
    console.error("Avatar upload failed:", err);
    alert("Failed to upload avatar.");
  }
};
</script>

<style scoped>
/* Authenticated app shell: full screen. Guest pages keep their existing centered layout. */
.layout-container { display: flex; width: 100vw; height: 100vh; max-width: none; background: var(--color-page, var(--color-bg)); border: none; border-radius: 0; overflow: hidden; box-shadow: none; }
.sidebar { width: 248px; background: var(--color-bg); border-right: 1px solid var(--color-border); padding: 1.15rem; display: flex; flex-direction: column; flex-shrink: 0; }
.content-area { flex: 1; display: flex; flex-direction: column; background: var(--color-page, var(--color-bg)); overflow-y: auto; overflow-x: hidden; position: relative; --page-x: clamp(1rem, 1.55vw, 1.65rem); --page-y: clamp(.8rem, 1.1vw, 1rem); --card-pad: clamp(.95rem, 1.2vw, 1.15rem); --shell-header-height: 126px; }



/* Shared authenticated page headers. The bottom border is aligned with the
   sidebar divider between user profile and navigation. */
.content-area :deep(.content-header) {
  min-height: var(--shell-header-height);
  padding: 2rem 3rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  box-sizing: border-box;
}
.content-area :deep(.admin-header) {
  min-height: var(--shell-header-height);
  padding: 2rem 3rem 0 3rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
  box-sizing: border-box;
}
.content-area :deep(.header-title) {
  min-width: 0;
}
.content-area :deep(.header-title h2),
.content-area :deep(.header-text h2) {
  font-size: 1.5rem;
  line-height: 1.1;
  margin: 0 0 4px;
  font-weight: 700;
  letter-spacing: -.025em;
}
.content-area :deep(.header-title p) {
  color: var(--color-text-muted);
  margin: 0;
  font-size: .92rem;
}
@media (max-width: 900px) {
  .content-area { --shell-header-height: auto; }
  .content-area :deep(.content-header),
  .content-area :deep(.admin-header) {
    min-height: 0;
    padding: 1rem;
  }
}

.brand { font-size: 1.08rem; font-weight: 700; color: var(--color-primary); margin-bottom: 1.25rem; display: flex; align-items: center; gap: 10px; cursor: pointer; letter-spacing: -.01em; }

/* 用户信息 */
.user-profile { display: flex; align-items: center; gap: 10px; padding-bottom: 1.15rem; border-bottom: 1px solid var(--color-border); margin-bottom: 1rem; }
.avatar-wrapper { position: relative; width: 42px; height: 42px; border-radius: 50%; border: 2px solid var(--color-border); cursor: pointer; overflow: hidden; flex-shrink: 0; }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); color: white; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; font-size: 1.2rem; }
.avatar-wrapper:hover .avatar-overlay { opacity: 1; }
.user-info { display: flex; flex-direction: column; overflow: hidden; }
.u-name { font-weight: 700; font-size: 0.95rem; color: var(--color-text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.u-role { font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

/* 导航样式 */
.nav-links { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.nav-item { text-align: left; background: transparent; border: none; padding: 10px 11px; border-radius: var(--radius); cursor: pointer; color: var(--color-text-muted); font-weight: 700; font-size: 0.93rem; display: flex; align-items: center; gap: 10px; transition: all 0.2s; }
.nav-item i { width: 20px; text-align: center; flex-shrink: 0; } /* 关键对齐样式 */
.nav-item:hover:not(.disabled) { background: rgba(0,0,0,0.03); color: var(--color-text-main); }
.nav-item.active { background: rgba(51, 187, 173, 0.11); color: var(--color-accent); box-shadow: inset 3px 0 0 var(--color-accent); }
.nav-item.disabled { opacity: 0.6; cursor: default; }
.coming-soon { font-size: 0.6rem; background: var(--color-border); padding: 2px 6px; border-radius: 4px; margin-left: auto; }
.admin-link { }
.admin-link:hover { background: rgba(79, 70, 229, 0.08); color: var(--color-primary); }

.sidebar-footer { margin-top: auto; border-top: 1px solid var(--color-border); padding-top: 1rem; }
.footer-controls { display: grid; grid-template-columns: minmax(0, 1fr) 38px; gap: 8px; align-items: center; margin-bottom: 8px; }
.footer-language { min-width: 0; }
.layout-theme-toggle { background: var(--color-bg); border: 1px solid var(--color-border); width: 38px; height: 38px; border-radius: var(--radius); color: var(--color-text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.layout-theme-toggle:hover { background: var(--color-surface); color: var(--color-text-main); border-color: var(--color-primary); }
.back-btn { width: 100%; background: none; border: 1px solid var(--color-border); padding: 8px 10px; border-radius: var(--radius); cursor: pointer; color: var(--color-text-muted); font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.2s; }
.back-btn:hover { border-color: var(--color-danger); color: var(--color-danger); background: rgba(239,68,68,0.05); }

@media (max-width: 780px) {
  .sidebar { width: 220px; padding: 1rem; }
  .brand { margin-bottom: 1.25rem; }
  .user-profile { padding-bottom: 1.25rem; margin-bottom: 1rem; }
}
</style>
