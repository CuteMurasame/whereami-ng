<template>
  <DashboardLayout page="settings">
    
    <header class="content-header">
      <div class="header-title">
        <h2>{{ t('settings.title') }}</h2>
        <p>{{ t('settings.subtitle') }}</p>
      </div>
      <BackButton fallback="/lobby" />
    </header>

    <div class="scroll-content">
      <div class="info-list">
        
        <div class="info-strip">
          <div class="strip-header">
            <div class="strip-icon"><i class="fa-solid fa-pen-nib"></i></div>
            <div class="strip-text">
              <h3>{{ t('settings.publicBio') }}</h3>
              <p>{{ t('settings.publicBioDesc') }}</p>
            </div>
          </div>
          
          <div class="form-area">
            <div class="textarea-wrapper">
              <textarea 
                v-model="bio" 
                :placeholder="t('settings.placeholder')" 
                rows="4"
                maxlength="500"
              ></textarea>
              <div class="char-count">{{ bio.length }}/500</div>
            </div>
            
            <div class="form-footer">
              <button @click="saveBio" :disabled="saving" class="btn primary-btn">
                <span v-if="saving"><i class="fa-solid fa-spinner fa-spin"></i> {{ t('settings.saving') }}</span>
                <span v-else><i class="fa-solid fa-save"></i> {{ t('settings.save') }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="info-strip">
          <div class="strip-header">
            <div class="strip-icon"><i class="fa-solid fa-user-astronaut"></i></div>
            <div class="strip-text">
              <h3>{{ t('settings.identity') }}</h3>
              <p>{{ t('settings.identityDesc') }}</p>
            </div>
          </div>
          <div class="details-grid">
            <div class="detail-item">
              <span class="label">{{ t('settings.username') }}</span>
              <span class="value">{{ user?.username }}</span>
            </div>
            <div class="detail-item">
              <span class="label">{{ t('settings.userId') }}</span>
              <span class="value code-font">#{{ user?.id }}</span>
            </div>
             <div class="detail-item">
              <span class="label">{{ t('settings.email') }}</span>
              <span class="value">{{ user?.email || t('settings.notLinked') }}</span>
            </div>
          </div>
        </div>


        <div class="info-strip">
          <div class="strip-header">
            <div class="strip-icon"><i class="fa-solid fa-keyboard"></i></div>
            <div class="strip-text">
              <h3>{{ t('settings.gameplay') }}</h3>
              <p>{{ t('settings.gameplayDesc') }}</p>
            </div>
          </div>
          <div class="details-grid">
            <label class="preference-toggle">
              <input type="checkbox" v-model="spaceSubmitGuessEnabled" @change="saveGameplayPreferences" />
              <span class="toggle-shell"><span class="toggle-knob"></span></span>
              <span>
                <strong>{{ t('settings.spaceSubmitGuess') }}</strong>
                <em>{{ t('settings.spaceSubmitGuessDesc') }}</em>
              </span>
            </label>
          </div>
        </div>

        <div class="info-strip">
          <div class="strip-header">
            <div class="strip-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg></div>
            <div class="strip-text">
              <h3>Google Account</h3>
              <p>{{ t('auth.bindGoogle') }}</p>
            </div>
          </div>
          <div class="details-grid">
             <div class="detail-item" v-if="user?.google_id">
              <span class="label">{{ t('admin.status') }}</span>
              <span class="value" style="color: var(--color-success);"><i class="fa-solid fa-check-circle"></i> {{ t('auth.googleLinked') }}</span>
            </div>
            <div class="detail-item" v-else>
               <span class="label">{{ t('admin.status') }}</span>
               <span class="value" style="color: var(--color-text-muted);">{{ t('auth.googleNotLinked') }}</span>
            </div>
            <div class="detail-item" v-if="user?.google_id">
              <span class="label">{{ t('settings.googleEmail') }}</span>
              <span class="value">{{ user?.google_email || t('settings.notLinked') }}</span>
            </div>
             <div class="detail-item">
               <button v-if="!user?.google_id" @click="startGoogleBind" :disabled="isBindingGoogle" class="btn secondary-btn">
                 <i :class="isBindingGoogle ? 'fa-solid fa-spinner fa-spin' : 'fa-brands fa-google'"></i> {{ t('auth.bindGoogle') }}
               </button>
               <button v-else @click="unlinkGoogle" :disabled="isUnlinkingGoogle" class="btn danger-btn">
                 <i :class="isUnlinkingGoogle ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-link-slash'"></i> {{ t('auth.unlinkGoogle') }}
               </button>
            </div>
          </div>
        </div>

        <div class="info-strip highlight-strip">
          <div class="strip-header">
             <div class="strip-icon blue-icon"><i class="fa-solid fa-eye"></i></div>
             <div class="strip-text">
               <h3>{{ t('settings.publicProfile') }}</h3>
               <p>{{ t('settings.publicProfileDesc') }}</p>
             </div>
          </div>
          <button @click="router.push(`/user/${user?.id}`)" class="btn secondary-btn">
            {{ t('settings.viewProfile') }} <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>

      </div>
    </div>

  </DashboardLayout>
</template>

<script setup>
import DashboardLayout from '../components/DashboardLayout.vue';
import BackButton from '../components/BackButton.vue';
import { ref, computed, onMounted } from 'vue';
import { authState, api } from '../auth';
import { useRouter, useRoute } from 'vue-router';
import Swal from 'sweetalert2'; // 引入 SweetAlert
import { useI18n } from 'vue-i18n';
import { isSpaceSubmitGuessEnabled, setSpaceSubmitGuessEnabled } from '../utils/preferences';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const user = computed(() => authState.user);
const bio = ref('');
const saving = ref(false);
const isBindingGoogle = ref(false);
const isUnlinkingGoogle = ref(false);
const spaceSubmitGuessEnabled = ref(isSpaceSubmitGuessEnabled());

onMounted(async () => {
    await authState.refreshSession();
    if (user.value?.bio) bio.value = user.value.bio;

    // Check for status
    if (route.query.status) {
        const status = route.query.status;
        if (status === 'success') {
            Swal.fire({
                icon: 'success',
                title: t('auth.bindSuccess'),
                showConfirmButton: false,
                timer: 2000,
                showClass: {
                  popup: 'animate__animated animate__zoomIn animate__faster'
                },
                hideClass: {
                  popup: 'animate__animated animate__fadeOut animate__faster'
                }
            });
            // Remove query param
            router.replace({ query: null });
        } else if (status === 'already_linked') {
             Swal.fire({
                icon: 'info',
                title: t('auth.alreadyLinked'),
                showConfirmButton: true,
                showClass: {
                  popup: 'animate__animated animate__zoomIn animate__faster'
                },
                hideClass: {
                  popup: 'animate__animated animate__fadeOut animate__faster'
                }
            });
        } else if (status === 'google_taken') {
             Swal.fire({
                icon: 'error',
                title: t('auth.googleTaken'),
                text: t('auth.googleTakenDesc'),
                showConfirmButton: true,
                showClass: {
                  popup: 'animate__animated animate__zoomIn animate__faster'
                },
                hideClass: {
                  popup: 'animate__animated animate__fadeOut animate__faster'
                }
            });
        } else if (['invalid_state', 'email_taken', 'google_no_email', 'user_not_found'].includes(status)) {
            Swal.fire({
                icon: 'error',
                title: t('settings.errorTitle'),
                text: status,
                showConfirmButton: true,
                showClass: {
                  popup: 'animate__animated animate__zoomIn animate__faster'
                },
                hideClass: {
                  popup: 'animate__animated animate__fadeOut animate__faster'
                }
            });
            router.replace({ query: null });
        }
    }
});

const startGoogleBind = async () => {
    isBindingGoogle.value = true;
    try {
        const res = await api.post('/auth/google/bind-ticket');
        window.location.href = res.data.url;
    } catch (err) {
        isBindingGoogle.value = false;
        Swal.fire({
          icon: 'error',
          title: t('settings.errorTitle'),
          text: err.response?.data?.error || t('settings.errorText'),
          showClass: {
            popup: 'animate__animated animate__zoomIn animate__faster'
          },
          hideClass: {
            popup: 'animate__animated animate__fadeOut animate__faster'
          }
        });
    }
};

const unlinkGoogle = async () => {
    const result = await Swal.fire({
      icon: 'warning',
      title: t('auth.unlinkGoogle'),
      text: t('auth.unlinkGoogleConfirm'),
      showCancelButton: true,
      confirmButtonText: t('auth.unlinkGoogleConfirmButton'),
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#dc2626',
      showClass: {
        popup: 'animate__animated animate__zoomIn animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOut animate__faster'
      }
    });

    if (!result.isConfirmed) return;

    isUnlinkingGoogle.value = true;
    try {
        await api.post('/auth/google/unlink');
        await authState.refreshSession();
        Swal.fire({
          icon: 'success',
          title: t('auth.unlinkSuccess'),
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
    } catch (err) {
        Swal.fire({
          icon: 'error',
          title: t('settings.errorTitle'),
          text: err.response?.data?.error || t('settings.errorText'),
          showClass: {
            popup: 'animate__animated animate__zoomIn animate__faster'
          },
          hideClass: {
            popup: 'animate__animated animate__fadeOut animate__faster'
          }
        });
    } finally {
        isUnlinkingGoogle.value = false;
    }
};

const saveGameplayPreferences = () => {
    setSpaceSubmitGuessEnabled(spaceSubmitGuessEnabled.value);
    Swal.fire({
      icon: 'success',
      title: t('settings.savedTitle'),
      text: t('settings.savedText'),
      timer: 1400,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
};

const saveBio = async () => {
    saving.value = true;
    try {
        await api.put('/user/update', { bio: bio.value });
        await authState.refreshSession();
        
        // 使用 Swal 提示
        Swal.fire({
          icon: 'success',
          title: t('settings.savedTitle'),
          text: t('settings.savedText'),
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
          showClass: {
            popup: 'animate__animated animate__zoomIn animate__faster'
          },
          hideClass: {
            popup: 'animate__animated animate__fadeOut animate__faster'
          }
        });

    } catch (err) {
        Swal.fire({
          icon: 'error',
          title: t('settings.errorTitle'),
          text: err.response?.data?.error || t('settings.errorText'),
          showClass: {
            popup: 'animate__animated animate__zoomIn animate__faster'
          },
          hideClass: {
            popup: 'animate__animated animate__fadeOut animate__faster'
          }
        });
    } finally {
        saving.value = false;
    }
};
</script>

<style>
.swal2-popup.animate__faster {
  animation-duration: 200ms !important;
}
</style>

<style scoped>
/* 继承通用样式 */
.content-header { padding: var(--page-y) var(--page-x); border-bottom: 1px solid var(--color-border); display: flex; align-items: center; justify-content: space-between; gap: 1rem; background: var(--color-bg); }
.header-title h2 { font-size: 1.34rem; line-height: 1.1; margin: 0 0 3px; font-weight: 700; letter-spacing: -.02em; }
.header-title p { color: var(--color-text-muted); margin: 0; }
.scroll-content { padding: var(--page-y) var(--page-x); overflow-y: auto; flex: 1; background: var(--color-page, var(--color-bg)); }

.info-list {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(360px, .82fr);
  grid-template-areas:
    "bio identity"
    "bio gameplay"
    "google profile";
  gap: 1rem;
  align-items: start;
}
.info-strip { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 12px; padding: 1rem 1.15rem; display: flex; flex-direction: column; gap: 1rem; transition: all 0.2s; box-shadow: var(--shadow-card); min-width: 0; }
.info-strip:nth-child(1) { grid-area: bio; }
.info-strip:nth-child(2) { grid-area: identity; }
.info-strip:nth-child(3) { grid-area: gameplay; }
.info-strip:nth-child(4) { grid-area: google; }
.info-strip:nth-child(5) { grid-area: profile; }
@media (min-width: 1500px) {
  .info-list {
    grid-template-columns: minmax(420px, 1.05fr) minmax(340px, .72fr) minmax(340px, .72fr);
    grid-template-areas:
      "bio identity gameplay"
      "bio google profile";
  }
}
@media (max-width: 1050px) {
  .info-list {
    grid-template-columns: 1fr;
    grid-template-areas:
      "bio"
      "identity"
      "gameplay"
      "google"
      "profile";
  }
}

.strip-header { display: flex; align-items: flex-start; gap: 16px; }
.strip-icon { width: 44px; height: 44px; border-radius: 10px; background: var(--color-surface); color: var(--color-text-muted); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; }
.blue-icon { background: rgba(79, 70, 229, 0.1); color: var(--color-primary); }
.strip-text h3 { font-size: 1.05rem; margin: 0 0 4px 0; font-weight: 700; }
.strip-text p { margin: 0; color: var(--color-text-muted); font-size: 0.9rem; }

/* 表单美化 */
.textarea-wrapper { position: relative; }
.form-area textarea { 
  width: 100%; background: var(--color-surface); border: 1px solid var(--color-border); 
  border-radius: 8px; padding: 12px; font-family: inherit; color: var(--color-text-main); 
  resize: vertical; font-size: 0.95rem; line-height: 1.5; transition: border 0.2s;
}
.form-area textarea:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }
.char-count { position: absolute; bottom: 12px; right: 12px; font-size: 0.75rem; color: var(--color-text-muted); background: var(--color-surface); padding: 2px 6px; border-radius: 4px; }

.form-footer { display: flex; justify-content: flex-end; margin-top: 12px; }

/* 按钮美化 */
.btn { 
  padding: 10px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.95rem; 
  display: flex; align-items: center; gap: 8px; transition: all 0.2s; border: none;
}

.primary-btn { 
  background: var(--color-primary); color: white; 
  box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2); 
}
.primary-btn:hover:not(:disabled) { 
  background: var(--color-primary-hover, #4338ca); 
  transform: translateY(-1px); 
  box-shadow: 0 4px 6px rgba(79, 70, 229, 0.3); 
}
.primary-btn:disabled { opacity: 0.7; cursor: wait; }

.secondary-btn { 
  background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-main); align-self: flex-start; 
}
.secondary-btn:hover { border-color: var(--color-primary); color: var(--color-primary); background: rgba(79, 70, 229, 0.05); }
.danger-btn {
  background: #fee2e2;
  border: 1px solid #fecaca;
  color: #dc2626;
  align-self: flex-start;
}
.danger-btn:hover:not(:disabled) {
  background: #fecaca;
  transform: translateY(-1px);
}
.danger-btn:disabled { opacity: 0.7; cursor: wait; }

.details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; padding-top: 10px; border-top: 1px solid var(--color-border); }
.detail-item { display: flex; flex-direction: column; }
.label { font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; margin-bottom: 6px; font-weight: 700; letter-spacing: 0.05em; }
.value { font-weight: 600; font-size: 1rem; }
.code-font { font-family: monospace; background: var(--color-surface); padding: 2px 6px; border-radius: 4px; width: fit-content; }

.preference-toggle {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: .8rem .9rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  cursor: pointer;
}
.preference-toggle input { position: absolute; opacity: 0; pointer-events: none; }
.preference-toggle strong { display: block; color: var(--color-text-main); font-weight: 700; }
.preference-toggle em { display: block; color: var(--color-text-muted); font-style: normal; font-size: .88rem; margin-top: 2px; }
.toggle-shell { width: 48px; height: 28px; border-radius: 999px; background: #cbd5e1; padding: 3px; flex: 0 0 auto; transition: background .18s ease; }
.toggle-knob { display: block; width: 22px; height: 22px; border-radius: 999px; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.24); transition: transform .18s ease; }
.preference-toggle input:checked + .toggle-shell { background: var(--color-primary); }
.preference-toggle input:checked + .toggle-shell .toggle-knob { transform: translateX(20px); }

</style>
