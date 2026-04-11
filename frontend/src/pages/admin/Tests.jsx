import TestsManager from "../../components/tests/TestsManager.jsx";
import {
  bulkUploadAdminTest,
  createAdminTest,
  downloadAdminTestTemplate,
  getAdminTestById,
  getAdminTests,
  getClasses,
} from "../../services/admin.service.js";

function AdminTests() {
  return (
    <TestsManager
      actor="admin"
      fetchTests={getAdminTests}
      createTest={createAdminTest}
      fetchClasses={getClasses}
      fetchTestById={getAdminTestById}
      bulkUploadTest={bulkUploadAdminTest}
      downloadTestTemplate={downloadAdminTestTemplate}
    />
  );
}

export default AdminTests;
