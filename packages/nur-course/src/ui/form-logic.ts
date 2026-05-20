import { PhoneValidator } from '../domain/phone';
import UserSessionManager from '@app/ui/user-session-manager.js';

export function showValidationError(element: HTMLElement, message: string) {
  const cardContent = element.querySelector('.card-content');
  if (!cardContent) return; // Если структура не найдена, ничего не делаем

  let errorSpan = cardContent.querySelector<HTMLElement>('.validation-error');
  if (!errorSpan) {
    errorSpan = document.createElement('div');
    errorSpan.className = 'validation-error w3-panel w3-pale-red w3-leftbar w3-border-red';
    errorSpan.style.width = '100%'; // Растягиваем на всю ширину
    errorSpan.style.marginTop = '10px';
    cardContent.appendChild(errorSpan);
  }
  errorSpan.innerHTML = `<p>${message}</p>`;
  element.classList.add('w3-border-red'); // Подсвечиваем рамку всей карточки
}

export function clearValidationErrors(form: HTMLFormElement) {
  form.querySelectorAll('.validation-error').forEach(el => el.remove());
  form.querySelectorAll('.w3-border-red').forEach(el => el.classList.remove('w3-border-red'));
}

export function validateForm(form: HTMLFormElement): boolean {
  clearValidationErrors(form);
  let firstInvalidElement: HTMLElement | null = null;

  const getFieldCard = (fieldName: string): HTMLElement | null => {
    const field = form.querySelector(`[name="${fieldName}"]`);
    return field ? field.closest('.w3-card') as HTMLElement : null;
  };

  const setError = (element: HTMLElement | null, message: string) => {
    if (element) {
      showValidationError(element, message);
      if (!firstInvalidElement) {
        firstInvalidElement = element;
      }
    }
    return false; // Для удобного присваивания isValid
  };

  let isValid = true;

  // Валидация текстовых полей
  const nameInput = form.querySelector<HTMLInputElement>('#name');
  if (!nameInput?.value.trim()) {
    isValid = setError(getFieldCard('name'), 'Пожалуйста, введите ваше имя.');
  }

  const phoneInput = form.querySelector<HTMLInputElement>('#phone');
  const countryCodeSelect = form.querySelector<HTMLSelectElement>('#countryCode');
  if (!phoneInput?.value.trim()) {
    isValid = setError(getFieldCard('phone'), 'Пожалуйста, введите номер телефона.');
  } else if (phoneInput && countryCodeSelect && !PhoneValidator.isValid(phoneInput.value, countryCodeSelect.value as any)) {
    isValid = setError(getFieldCard('phone'), 'Неверный формат номера для выбранной страны.');
  }

  // Валидация групп чекбоксов/радиокнопок
  const requiredGroups = [
    'contactMethod', 'howFoundUs', 'whyInterested', 'programmingExperience',
    'languageInterest', 'learningFormat', 'preferredTime'
  ];

  requiredGroups.forEach(groupName => {
    const inputs = form.querySelectorAll<HTMLInputElement>(`input[name="${groupName}"]`);
    if (inputs.length > 0) {
      const isChecked = Array.from(inputs).some(input => input.checked);
      if (!isChecked) {
        isValid = setError(getFieldCard(groupName), 'Пожалуйста, выберите хотя бы один вариант.');
      }
    }
  });

  const preferredDayInputs = form.querySelectorAll<HTMLInputElement>('input[name="preferredDay"]');
  if (preferredDayInputs.length > 0) {
    const selectedDays = Array.from(preferredDayInputs).filter(input => input.checked).map(input => input.value);
    const isAnyDaySelected = selectedDays.includes('Любой день');

    if (selectedDays.length === 0) {
      isValid = setError(getFieldCard('preferredDay'), 'Пожалуйста, выберите хотя бы один день.');
    } else if (isAnyDaySelected && selectedDays.length > 1) {
      isValid = setError(getFieldCard('preferredDay'), 'Если выбран "Любой день", другие дни выбирать нельзя.');
    } else if (!isAnyDaySelected && selectedDays.length > 0 && selectedDays.length < 2) {
      isValid = setError(getFieldCard('preferredDay'), 'Пожалуйста, выберите минимум два дня (или выберите опцию "Любой день").');
    }
  }

  if (firstInvalidElement) {
    firstInvalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return isValid;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // Получаем userId из UserSessionManager вместо URL параметров
    const userId = UserSessionManager.getOrCreateUserId();
    
    // Находим поле userId в форме и устанавливаем значение
    const userIdField = document.getElementById('userId') as HTMLInputElement;
    if (userIdField) {
      userIdField.value = userId;
      console.log('DEBUG: userId из UserSessionManager:', userId);
    } else {
      console.warn('User ID field not found in form.');
    }

    const form = document.getElementById('courseApplicationForm') as HTMLFormElement;
    if (!form) {
      console.warn('Course application form not found.');
      return;
    }

    const phoneInput = form.querySelector<HTMLInputElement>('#phone');
    const countryCodeSelect = form.querySelector<HTMLSelectElement>('#countryCode');

    if (phoneInput && countryCodeSelect) {
      phoneInput.addEventListener('input', () => {
        const countryCode = countryCodeSelect.value as any;
        phoneInput.value = PhoneValidator.asYouType(phoneInput.value, countryCode);
      });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!validateForm(form)) {
        console.log('Form validation failed.');
        return;
      }

      // --- Сбор данных ---
      const formData = new FormData(form);
      const data: { [key: string]: string | string[] } = {};
      
      formData.forEach((value, key) => {
        if (typeof value !== 'string') return; // Игнорируем файлы

        const existing = data[key];
        if (existing) {
          if (Array.isArray(existing)) {
            existing.push(value);
          } else {
            data[key] = [existing, value];
          }
        } else {
          data[key] = value;
        }
      });

      // Форматируем телефонный номер
      if (phoneInput && countryCodeSelect) {
        const formattedPhone = PhoneValidator.parseAndFormat(phoneInput.value, countryCodeSelect.value as any);
        if (formattedPhone) {
          data.phone = formattedPhone;
        }
      }

      // Убеждаемся, что userId всегда присутствует (из UserSessionManager)
      data.userId = userId;

      const webhookUrl = '/api/submit-form';

      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (response.ok) {
          alert('Анкета успешно отправлена! Спасибо!');
          form.reset();
          
          // Обновляем время активности после отправки формы
          UserSessionManager.updateLastActivity();
        } else {
          alert('Ошибка при отправке анкеты. Пожалуйста, попробуйте еще раз.');
          console.error('Ошибка отправки формы:', response.status, response.statusText);
        }
      } catch (error: any) {
        alert('Произошла ошибка сети. Пожалуйста, проверьте ваше соединение.');
        console.error('Ошибка сети при отправке формы:', error);
      }
    });
  });
}
