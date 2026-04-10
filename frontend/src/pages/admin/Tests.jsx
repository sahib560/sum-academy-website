import TestsManager from "../../components/tests/TestsManager.jsx";
import {
  createAdminTest,
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
    />
  );
}

export default AdminTests;
