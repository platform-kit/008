import { createContext } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';
import {
  persist,
  createJSONStorage,
  subscribeWithSelector
} from 'zustand/middleware';
import { encode } from 'base-64';
import _ from 'lodash';

import { getMicrophones, getSpeakers } from '../Sound';
import Contacts from './Contacts';

const contacts = new Contacts();

const COOKIE_ID = 'KZS';
const CONTACTS_ID = 'KZSC';

const initializeStore = async state => {
  const requestPermissions = async () => {
    await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    });

    await Notification.requestPermission();
  };

  const initAudioDevices = async () => {
    const setAudioDevices = async () => {
      const devices = await getSpeakers();
      const microphones = await getMicrophones();

      state.setSettings({ devices, microphones });
    };

    if (Platform.OS === 'web') {
      navigator.mediaDevices.ondevicechange = setAudioDevices;
    }
    setAudioDevices();
  };

  const initContacts = () => {
    if (Platform.OS === 'web') {
      document.addEventListener('indexing:end', async () => {
        const contactsDialer = contacts.query({ query: '' });
        state.setSettings({ contactsDialer });

        contacts.save(CONTACTS_ID);
      });
    }

    contacts.load(CONTACTS_ID);
  };

  await requestPermissions();
  initAudioDevices();
  initContacts();
};

const DEFAULTS = {
  status: 'online',
  statuses: [
    { value: 'online', text: 'Online', color: '#057e74' },
    { value: 'offline', text: 'Offline', color: '#A9A9A9' }
  ],

  devices: [],
  microphones: [],
  ringer: 'default',
  speaker: 'default',
  microphone: 'default',

  number_out: undefined,
  numbers: [],

  sipUri: undefined,
  sipUser: undefined,
  sipPassword: undefined,
  wsUri: undefined,

  allowTransfer: true,
  allowBlindTransfer: true,
  allowVideo: true,
  allowAutoanswer: false,
  autoanswer: 5,

  settingsUri: undefined,
  nickname: undefined,
  password: undefined,
  avatar: undefined,

  contactsDialer: {},
  contactsDialerFilter: '',
  cdrs: [],
  webhooks: [],

  size: { width: 340, height: 460 }
};

export const useStore = create(
  persist(
    subscribeWithSelector((set, get) => {
      return {
        ...DEFAULTS,

        electron: false,
        anchored: true,
        doquit: false,

        setSettings: settings => {
          set(() => ({ ...settings }));
        },

        login: async ({ settingsUri, nickname, password }) => {
          if (!settingsUri) throw new Error(`No settings uri available!`);

          const headers = {
            'Content-Type': 'application/json',
            Authorization: `Basic ${encode(`${nickname}:${password}`)}`
          };

          let response;

          if (!/^(https?|file):\/\//i.test(settingsUri)) {
            try {
              response = await fetch(`file://${settingsUri}`, {
                method: 'GET',
                headers
              });
            } catch (err) {
              console.error(err);
            }
          }

          if (!response?.ok) {
            response = await fetch(settingsUri, {
              method: 'GET',
              headers
            });

            if (!response.ok)
              throw new Error(`HTTP status: ${response.status}`);
          }

          const settings = await response.json();
          set(() => ({
            nickname,
            password,
            ...settings,
            settingsUri,
            showSettings: false
          }));
        },

        showSettings: false,
        settingsTab: null,
        toggleShowSettings: (value, tab) => {
          set(state => ({
            showSettings: _.isNil(value) ? !state.showSettings : value,
            settingsTab: tab
          }));
        },

        contacts: () => contacts,
        contactsDialer: {},
        contactsDialerFilter: '',
        setContactsDialerFilter: contactsDialerFilter => {
          const contactsDialer = contacts.query({
            query: contactsDialerFilter
          });
          set(() => ({ contactsDialer, contactsDialerFilter }));
        },

        cdrAdd: cdr => {
          const { cdrs } = get();
          const { headers, ...rest } = cdr;
          cdrs.unshift(rest);
          set(() => ({ cdrs: cdrs.slice(0, 100) }));
        },

        clear: () => {
          localStorage.clear();
          contacts.clear();

          set(() => ({ ...DEFAULTS }));

          initializeStore(get());
        }
      };
    }),
    {
      name: COOKIE_ID,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: state => initializeStore(state),
      partialize: ({
        doquit,
        devices,
        showSettings,
        settingsTab,
        showWebhookForm,
        ...rest
      }) => ({ ...rest })
    }
  )
);

export const Context = createContext();

export const ContextProvider = ({ children }) => (
  <Context.Provider value={useStore()}>{children}</Context.Provider>
);
