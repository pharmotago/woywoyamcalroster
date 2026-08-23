/**
 * Google Mixboard Visual Role & Design Studio (BriskSchedules)
 * Inspired by Google Labs Mixboard: Synthesizes high-contrast role badges,
 * harmonious pharmacy color palettes, and visual hierarchy tokens.
 */

export class MixboardStudio {
  static ROLES_PALETTE = {
    'Pharmacist': {
      label: 'Pharmacist',
      icon: 'fa-user-doctor',
      colorBg: 'rgba(16, 185, 129, 0.12)',
      colorBorder: 'rgba(16, 185, 129, 0.4)',
      colorText: '#34d399',
      badgeGradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      glowColor: 'rgba(16, 185, 129, 0.3)'
    },
    'Dispensary Technician': {
      label: 'Dispensary Tech',
      icon: 'fa-prescription-bottle-medical',
      colorBg: 'rgba(0, 229, 255, 0.12)',
      colorBorder: 'rgba(0, 229, 255, 0.4)',
      colorText: '#38bdf8',
      badgeGradient: 'linear-gradient(135deg, #0284c7 0%, #00e5ff 100%)',
      glowColor: 'rgba(0, 229, 255, 0.3)'
    },
    'Retail Manager': {
      label: 'Retail Manager',
      icon: 'fa-user-tie',
      colorBg: 'rgba(245, 158, 11, 0.12)',
      colorBorder: 'rgba(245, 158, 11, 0.4)',
      colorText: '#fbbf24',
      badgeGradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
      glowColor: 'rgba(245, 158, 11, 0.3)'
    },
    'Pharmacy Assistant': {
      label: 'Pharmacy Assistant',
      icon: 'fa-heart-pulse',
      colorBg: 'rgba(168, 85, 247, 0.12)',
      colorBorder: 'rgba(168, 85, 247, 0.4)',
      colorText: '#c084fc',
      badgeGradient: 'linear-gradient(135deg, #9333ea 0%, #a855f7 100%)',
      glowColor: 'rgba(168, 85, 247, 0.3)'
    },
    'Webster Packer': {
      label: 'Webster Packer',
      icon: 'fa-boxes-packing',
      colorBg: 'rgba(59, 130, 246, 0.12)',
      colorBorder: 'rgba(59, 130, 246, 0.4)',
      colorText: '#60a5fa',
      badgeGradient: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
      glowColor: 'rgba(59, 130, 246, 0.3)'
    },
    'Default': {
      label: 'Staff Member',
      icon: 'fa-user',
      colorBg: 'rgba(148, 163, 184, 0.12)',
      colorBorder: 'rgba(148, 163, 184, 0.4)',
      colorText: '#94a3b8',
      badgeGradient: 'linear-gradient(135deg, #475569 0%, #64748b 100%)',
      glowColor: 'rgba(148, 163, 184, 0.2)'
    }
  };

  /**
   * Returns styled HTML badge for any pharmacy role.
   */
  static renderRoleBadge(roleName = 'Default', isCompact = false) {
    const roleKey = Object.keys(this.ROLES_PALETTE).find(k => k.toLowerCase() === (roleName || '').toLowerCase()) || 'Default';
    const spec = this.ROLES_PALETTE[roleKey] || this.ROLES_PALETTE.Default;

    const pad = isCompact ? '2px 6px' : '4px 10px';
    const fontSize = isCompact ? '0.7rem' : '0.78rem';

    return `
      <span class="mixboard-role-badge" style="
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: ${pad};
        font-size: ${fontSize};
        font-weight: 600;
        border-radius: 6px;
        background: ${spec.colorBg};
        border: 1px solid ${spec.colorBorder};
        color: ${spec.colorText};
        box-shadow: 0 0 10px ${spec.glowColor};
        letter-spacing: 0.3px;
      ">
        <i class="fa-solid ${spec.icon}"></i>
        <span>${spec.label}</span>
      </span>
    `;
  }

  /**
   * Generates a complete design token card for UI inspectors.
   */
  static renderPaletteInspector() {
    return `
      <div class="mixboard-palette-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 10px;">
        ${Object.entries(this.ROLES_PALETTE).map(([key, item]) => `
          <div class="glass-card" style="padding: 12px; border-left: 4px solid ${item.colorText}; background: rgba(15, 23, 42, 0.6);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
              <strong style="font-size: 0.85rem; color: ${item.colorText};"><i class="fa-solid ${item.icon}"></i> ${key}</strong>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); line-height: 1.3;">
              <div>Background: <code>${item.colorBg}</code></div>
              <div>Text: <code>${item.colorText}</code></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
}

// Global window registration
if (typeof window !== 'undefined') {
  window.MixboardStudio = MixboardStudio;
}

export default MixboardStudio;
