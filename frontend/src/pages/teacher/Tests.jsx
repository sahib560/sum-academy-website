import TestsManager from "../../components/tests/TestsManager.jsx";
import {
  bulkUploadTeacherTest,
  createTeacherTest,
  downloadTeacherTestTemplate,
  downloadDetailedTestReportPdf,
  getTeacherClasses,
  getTeacherTestById,
  getTeacherTests,
} from "../../services/teacher.service.js";

function TeacherTests() {
  return (
    <TestsManager
      actor="teacher"
      fetchTests={getTeacherTests}
      createTest={createTeacherTest}
      fetchClasses={getTeacherClasses}
      fetchTestById={getTeacherTestById}
      bulkUploadTest={bulkUploadTeacherTest}
      downloadTestTemplate={downloadTeacherTestTemplate}
      downloadDetailedReport={downloadDetailedTestReportPdf}
    />
  );
}

export default TeacherTests;
