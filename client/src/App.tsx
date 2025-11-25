import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import PropertiesPage from './pages/PropertiesPage';
import PropertyDetailsPage from './pages/PropertyDetailsPage';
import PlatformsPage from './pages/PlatformsPage';
import QualificationConfigPage from './pages/QualificationConfigPage';
import InquiriesPage from './pages/InquiriesPage';
import InquiryDetailsPage from './pages/InquiryDetailsPage';
import SchedulingPage from './pages/SchedulingPage';
import TemplatesPage from './pages/TemplatesPage';
import TestModePage from './pages/TestModePage';
import EmailConnectionPage from './pages/EmailConnectionPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/inquiries" replace />} />
        <Route element={<Layout />}>
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/properties/:id" element={<PropertyDetailsPage />} />
          <Route path="/platforms" element={<PlatformsPage />} />
          <Route path="/email" element={<EmailConnectionPage />} />
          <Route path="/email-connection" element={<EmailConnectionPage />} />
          <Route path="/properties/:id/qualification" element={<QualificationConfigPage />} />
          <Route path="/inquiries" element={<InquiriesPage />} />
          <Route path="/inquiries/:id" element={<InquiryDetailsPage />} />
          <Route path="/scheduling" element={<SchedulingPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/test-mode" element={<TestModePage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
