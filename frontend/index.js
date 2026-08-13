import {initializeBlock} from '@airtable/blocks/interface/ui';
import App from './App';
import './style.css';

initializeBlock({interface: () => <App />});
