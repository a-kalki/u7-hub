export class ChatManager {
    private modal: HTMLElement | null = null;
    private chatInput: HTMLInputElement | null = null;

    constructor() {
        this.init();
    }

    private init(): void {
        this.modal = document.getElementById('chat-modal');
        this.chatInput = document.getElementById('chat-input') as HTMLInputElement;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Закрытие по клику на фон
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Закрытие по кнопке
        const closeBtn = document.querySelector('.modal-close');
        closeBtn?.addEventListener('click', () => this.close());

        // Закрытие по ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal?.style.display === 'block') {
                this.close();
            }
        });
    }

    public open(): void {
        if (this.modal) {
            this.modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            
            // Фокус на поле ввода
            setTimeout(() => {
                if (this.chatInput && !this.isMobileDevice()) {
                    this.chatInput.focus();
                }
            }, 300);
        }
    }

    public close(): void {
        if (this.modal) {
            this.modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    public isOpen(): boolean {
        return this.modal?.style.display === 'block';
    }

    private isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }
}

// Глобальные функции для HTML
export function openChatModal() {
    if (window.chatManager) {
        window.chatManager.open();
    }
}

export function closeChatModal() {
    if (window.chatManager) {
        window.chatManager.close();
    }
}

// Глобальный экземпляр для использования в HTML
declare global {
    interface Window {
        chatManager: ChatManager;
    }
}
